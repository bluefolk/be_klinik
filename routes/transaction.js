const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');
const { snap, core } = require('../config/midtrans');
const { statusCheckLimiter } = require('../middleware/errorHandler');

// Initialize Firestore
const db = admin.firestore();

// Create or get order, create tagihan, and initiate transaction
router.post('/create-transaction', verifyToken, async (req, res) => {
  try {
    const { bookingId, orderId, amount, customer_details, payment_type } = req.body;

    // Validate required fields
    if (!bookingId || !orderId || !amount || !customer_details) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Step 1: Create or get order
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    let orderData;
    if (!orderDoc.exists) {
      orderData = {
        bookingId,
        orderId,
        amount,
        userId: req.user.uid,
        status: 'pending',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };
      await orderRef.set(orderData);
    } else {
      orderData = orderDoc.data();
      // Verify order belongs to user
      if (orderData.userId !== req.user.uid) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    // Step 2: Create or get tagihan
    const tagihanRef = db.collection('tagihan').doc(orderId);
    const tagihanDoc = await tagihanRef.get();

    let tagihanData;
    if (!tagihanDoc.exists) {
      tagihanData = {
        orderId,
        bookingId,
        amount,
        status: 'pending',
        userId: req.user.uid,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };
      await tagihanRef.set(tagihanData);
    } else {
      tagihanData = tagihanDoc.data();
    }

    // Step 3: Check if transaction exists in Midtrans
    let existingMidtransTransaction;
    try {
      existingMidtransTransaction = await core.transaction.status(orderId);
      console.log('Found existing Midtrans transaction:', orderId);
    } catch (error) {
      if (error.httpStatusCode !== '404') {
        console.error('Error checking Midtrans transaction:', error);
      }
      // 404 means transaction doesn't exist, which is expected for new transactions
    }

    let snapResponse;
    if (!existingMidtransTransaction) {
      // Create new Midtrans transaction
      const snapPayload = {
        transaction_details: {
          order_id: orderId,
          gross_amount: parseInt(amount)
        },
        customer_details: {
          first_name: customer_details.name || 'Customer',
          email: customer_details.email || 'customer@example.com',
          phone: customer_details.phone || '08123456789'
        }
      };

      if (payment_type) {
        snapPayload.enabled_payments = [payment_type];
      }

      try {
        console.log('Creating new Midtrans transaction:', orderId);
        snapResponse = await snap.createTransaction(snapPayload);
        console.log('Midtrans transaction created successfully:', orderId);
        console.log('Snap response:', snapResponse);
      } catch (error) {
        console.error('Failed to create Midtrans transaction:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to create payment transaction'
        });
      }
    } else {
      console.log('Using existing Midtrans transaction:', orderId);
      snapResponse = {
        token: existingMidtransTransaction.snap_token,
        redirect_url: existingMidtransTransaction.redirect_url
      };
    }

    // Step 4: Create or update transaction document with Midtrans data
    const transactionRef = db.collection('transactions').doc(orderId);
    const transactionDoc = await transactionRef.get();

    let transactionData;
    if (!transactionDoc.exists) {
      transactionData = {
        orderId,
        bookingId,
        amount, 
        customer_details, 
        userId: req.user.uid,
        status: 'pending',
        payment_type: payment_type || null,
        snap_token: snapResponse.token,
        redirect_url: snapResponse.redirect_url,
        payment_url: `https://app.midtrans.com/snap/v2/vtweb/${snapResponse.token}`,
        midtrans_created: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };
      await transactionRef.set(transactionData);
    } else {
      transactionData = transactionDoc.data();
      // Update with new Midtrans data
      await transactionRef.update({
        snap_token: snapResponse.token,
        redirect_url: snapResponse.redirect_url,
        payment_url: `https://app.midtrans.com/snap/v2/vtweb/${snapResponse.token}`,
        midtrans_created: true,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      transactionData = {
        ...transactionData,
        snap_token: snapResponse.token,
        redirect_url: snapResponse.redirect_url,
        payment_url: `https://app.midtrans.com/snap/v2/vtweb/${snapResponse.token}`,
        midtrans_created: true
      };
    }

    res.status(201).json({
      success: true,
      data: {
        order: orderData,
        tagihan: tagihanData,
        transaction: transactionData
      }
    });
  } catch (error) {
    console.error('Error in transaction flow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process transaction'
    });
  }
});

// Handle Midtrans notification webhook
router.post('/notification', async (req, res) => {
  try {
    const notification = await snap.transaction.notification(req.body);
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    // Get all related documents
    const transactionRef = db.collection('transactions').doc(orderId);
    const orderRef = db.collection('orders').doc(orderId);
    const tagihanRef = db.collection('tagihan').doc(orderId);
    
    // Get transaction data
    const transactionDoc = await transactionRef.get();
    if (!transactionDoc.exists) {
      throw new Error('Transaction document not found');
    }
    const transaction = transactionDoc.data();
    
    // Get order data
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    const orderData = orderDoc.data();
    
    // Get booking reference from order
    const bookingRef = db.collection('bookings').doc(orderData.bookingId);

    let status = transaction.status;
    let paymentStatus = transaction.paymentStatus;
    let tagihanStatus = transaction.tagihanStatus;
    let isLocalStatus = true;

    // Map Midtrans status to our statuses
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      paymentStatus = 'Berhasil';
      status = 'confirmed';
      tagihanStatus = 'Berhasil';
    } else if (transactionStatus === 'pending') {
      paymentStatus = 'unpaid';
      status = 'pending';
      tagihanStatus = 'unpaid';
    } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
      paymentStatus = 'failed';
      status = 'cancelled';
      tagihanStatus = 'failed';
    }

    // Update all documents in a batch
    const batch = db.batch();

    // Update transaction
    batch.update(transactionRef, {
      paymentStatus: paymentStatus,
      status: status,
      tagihanStatus: tagihanStatus,
      midtrans_status: notification,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update order
    batch.update(orderRef, {
      paymentStatus: paymentStatus,
      status: status,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update tagihan
    batch.update(tagihanRef, {
      status: tagihanStatus,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update booking
    batch.update(bookingRef, {
      paymentStatus: paymentStatus,
      status: status,
      tagihanStatus: tagihanStatus,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Commit all updates
    await batch.commit();

    console.log(`Updated all documents for ${orderId}:`, {
      paymentStatus,
      status,
      tagihanStatus,
      midtrans_status: transactionStatus
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing notification:', error);
    res.status(500).json({ success: false, error: 'Failed to process notification' });
  }
});

// Check transaction status - with rate limiting
router.get('/check-status/:orderId', verifyToken, statusCheckLimiter, async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log('Checking status for order:', orderId);

    // Get all document references
    const transactionRef = db.collection('transactions').doc(orderId);
    const orderRef = db.collection('orders').doc(orderId);
    const tagihanRef = db.collection('tagihan').doc(orderId);

    // Get transaction data
    const transactionDoc = await transactionRef.get();
    if (!transactionDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    const transaction = transactionDoc.data();

    // Get order data to find booking
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    const orderData = orderDoc.data();
    
    // Get booking reference from order
    const bookingRef = db.collection('bookings').doc(orderData.bookingId);

    let status = transaction.status;
    let paymentStatus = transaction.paymentStatus;
    let tagihanStatus = transaction.tagihanStatus;
    let isLocalStatus = true;

    // Always check Midtrans status if we have a snap token
    if (transaction.snap_token) {
      try {
        const midtransStatus = await core.transaction.status(orderId);
        const transStatus = midtransStatus.transaction_status;
        isLocalStatus = false;

        // Map Midtrans status to our statuses
        if (transStatus === 'capture' || transStatus === 'settlement') {
          paymentStatus = 'Berhasil';
          status = 'confirmed';
          tagihanStatus = 'Berhasil';
        } else if (transStatus === 'pending') {
          paymentStatus = 'unpaid';
          status = 'pending';
          tagihanStatus = 'unpaid';
        } else if (['cancel', 'deny', 'expire'].includes(transStatus)) {
          paymentStatus = 'failed';
          status = 'cancelled';
          tagihanStatus = 'failed';
        }

        // Update all documents in a batch
        const batch = db.batch();

        // Update transaction
        batch.update(transactionRef, {
          paymentStatus: paymentStatus,
          status: status,
          tagihanStatus: tagihanStatus,
          midtrans_status: midtransStatus,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update order
        batch.update(orderRef, {
          paymentStatus: paymentStatus,
          status: status,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update tagihan
        batch.update(tagihanRef, {
          status: tagihanStatus,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update booking
        batch.update(bookingRef, {
          paymentStatus: paymentStatus,
          status: status,
          tagihanStatus: tagihanStatus,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Commit all updates
        await batch.commit();

        console.log(`Updated all documents for ${orderId}:`, {
          paymentStatus,
          status,
          tagihanStatus,
          midtrans_status: transStatus
        });
      } catch (error) {
        console.error('Error checking Midtrans status:', error);
        // Continue with local status if Midtrans check fails
      }
    }

    // Get latest document states after updates
    const [latestOrderDoc, tagihanDoc, bookingDoc] = await Promise.all([
      orderRef.get(),
      tagihanRef.get(),
      bookingRef.get()
    ]);

    res.json({
      success: true,
      data: {
        transaction: {
          orderId,
          status,
          paymentStatus,
          tagihanStatus,
          isLocalStatus,
          transaction_status: status // for backward compatibility
        },
        order: latestOrderDoc.exists ? latestOrderDoc.data() : null,
        tagihan: tagihanDoc.exists ? tagihanDoc.data() : null,
        booking: bookingDoc.exists ? bookingDoc.data() : null
      }
    });
  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check status'
    });
  }
});

// Create order document
router.post('/create-order', verifyToken, async (req, res) => {
  try {
    const { bookingId, orderId, amount, customerDetails, paymentType } = req.body;
    
    if (!bookingId || !orderId || !amount || !customerDetails || !paymentType) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields' 
      });
    }

    // Get or create order document
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    
    let order;
    if (!orderDoc.exists) {
      order = {
        bookingId,
        orderId,
        amount,
        customerDetails,
        paymentType,
        userId: req.user.uid,
        status: 'pending',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };
      await orderRef.set(order);
    } else {
      order = orderDoc.data();
      if (order.userId !== req.user.uid) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    // Get or create tagihan
    const tagihanRef = db.collection('tagihan').doc(orderId);
    const tagihanDoc = await tagihanRef.get();
    
    let tagihan;
    if (!tagihanDoc.exists) {
      tagihan = {
        bookingId,
        orderId,
        amount,
        status: 'pending',
        userId: req.user.uid,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };
      await tagihanRef.set(tagihan);
    } else {
      tagihan = tagihanDoc.data();
    }

    // Create Midtrans transaction
    let transaction;
    const transactionRef = db.collection('transactions').doc(orderId);
    const transactionDoc = await transactionRef.get();

    if (!transactionDoc.exists) {
      // Verify Midtrans client is ready
      if (!snap) {
        throw new Error('Midtrans client not initialized');
      }

      // Create Midtrans transaction
      const midtransPayload = {
        transaction_details: {
          order_id: orderId,
          gross_amount: parseInt(amount)
        },
        item_details: [{
          id: bookingId,
          price: parseInt(amount),
          quantity: 1,
          name: 'Medical Consultation'
        }],
        customer_details: {
          first_name: customerDetails.name || 'Customer',
          email: customerDetails.email || 'customer@example.com',
          phone: customerDetails.phone || '08123456789'
        }
      };

      // Add payment type if specified and valid
      const validPaymentTypes = ['credit_card', 'mandiri_clickpay', 'cimb_clicks',
        'bca_klikbca', 'bca_klikpay', 'bri_epay', 'echannel', 'permata_va',
        'bca_va', 'bni_va', 'other_va', 'gopay', 'indomaret', 'shopeepay'];
        
      if (paymentType && paymentType !== 'all') {
        if (validPaymentTypes.includes(paymentType)) {
          midtransPayload.enabled_payments = [paymentType];
        } else {
          console.warn(`Invalid payment type: ${paymentType}, allowing all payment methods`);
        }
      }

      try {
        console.log('Creating Midtrans transaction for order:', orderId);
        
        // Create transaction in Midtrans first
        const midtransResponse = await snap.createTransaction(midtransPayload);
        
        if (!midtransResponse || !midtransResponse.token || !midtransResponse.redirect_url) {
          console.error('Invalid Midtrans response:', midtransResponse);
          throw new Error('Invalid Midtrans response: missing token or redirect URL');
        }

        console.log('Midtrans transaction created successfully for order:', orderId);

        // Only create local transaction after Midtrans success
        transaction = {
          bookingId,
          orderId,
          amount: parseInt(amount),
          userId: req.user.uid,
          status: 'pending',
          payment_type: paymentType,
          snap_token: midtransResponse.token,
          redirect_url: midtransResponse.redirect_url,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        await transactionRef.set(transaction);
        console.log('Local transaction record created for order:', orderId);

      } catch (error) {
        console.error('Failed to create Midtrans transaction for order:', orderId);
        console.error('Error details:', error);
        
        if (error.ApiResponse) {
          console.error('Midtrans API Response:', error.ApiResponse);
        }
        
        // Clean up if Midtrans transaction failed
        await orderRef.delete();
        await tagihanRef.delete();
        console.log('Cleaned up local records for failed transaction:', orderId);
        
        // Throw appropriate error
        if (error.ApiResponse && error.ApiResponse.status_message) {
          throw new Error(`Payment error: ${error.ApiResponse.status_message}`);
        } else {
          throw new Error('Failed to process payment. Please try again.');
        }
      }
    } else {
      transaction = transactionDoc.data();
      if (transaction.userId !== req.user.uid) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    res.json({
      success: true,
      data: {
        order,
        tagihan,
        transaction
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create order' 
    });
  }
});

// Get order details
router.get('/order/:orderId', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const transactionDoc = await db.collection('transactions').doc(orderId).get();

    if (!transactionDoc.exists) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const transaction = transactionDoc.data();
    if (transaction.userId !== req.user.uid) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get associated tagihan document
    const tagihanSnapshot = await db.collection('tagihan')
      .where('orderId', '==', orderId)
      .limit(1)
      .get();

    const tagihanData = tagihanSnapshot.empty ? null : tagihanSnapshot.docs[0].data();

    res.json({
      success: true,
      data: {
        ...transaction,
        tagihan: tagihanData
      }
    });
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({ success: false, error: 'Failed to get order' });
  }
});

// Create new transaction and get payment URL
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.body;
    console.log('Creating transaction for order:', orderId);

    // Get order details
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderDoc.data();
    
    // Create transaction parameter
    let parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: order.amount
      },
      credit_card: {
        secure: true
      }
    };

    // Create transaction
    const transaction = await snap.createTransaction(parameter);
    
    // Save transaction details
    const transactionRef = db.collection('transactions').doc(orderId);
    await transactionRef.set({
      orderId: orderId,
      amount: order.amount,
      status: 'pending',
      paymentStatus: 'unpaid',
      tagihanStatus: 'unpaid',
      snap_token: transaction.token,
      payment_url: transaction.redirect_url,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Created transaction:', {
      orderId,
      token: transaction.token,
      redirect_url: transaction.redirect_url
    });

    res.json({
      success: true,
      data: {
        transaction: {
          orderId: orderId,
          token: transaction.token,
          payment_url: transaction.redirect_url
        }
      }
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create transaction'
    });
  }
});

// Get payment URL for existing transaction
router.get('/payment-url/:orderId', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log('Getting payment URL for order:', orderId);

    const transactionRef = db.collection('transactions').doc(orderId);
    const transactionDoc = await transactionRef.get();

    if (!transactionDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    const transaction = transactionDoc.data();

    // If we have an existing payment URL, return it
    if (transaction.payment_url) {
      return res.json({
        success: true,
        data: {
          transaction: {
            orderId: orderId,
            payment_url: transaction.payment_url,
            token: transaction.snap_token
          }
        }
      });
    }

    // If no payment URL, create new transaction
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderDoc.data();
    
    // Create new transaction
    let parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: order.amount
      },
      credit_card: {
        secure: true
      }
    };

    const newTransaction = await snap.createTransaction(parameter);
    
    // Update transaction with new details
    await transactionRef.update({
      snap_token: newTransaction.token,
      payment_url: newTransaction.redirect_url,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Updated transaction with new payment URL:', {
      orderId,
      token: newTransaction.token,
      redirect_url: newTransaction.redirect_url
    });

    res.json({
      success: true,
      data: {
        transaction: {
          orderId: orderId,
          token: newTransaction.token,
          payment_url: newTransaction.redirect_url
        }
      }
    });
  } catch (error) {
    console.error('Error getting payment URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment URL'
    });
  }
});

module.exports = router; 