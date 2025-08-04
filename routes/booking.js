const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');

// Initialize Firestore
const db = admin.firestore();

// Create new booking
router.post('/bookings', verifyToken, async (req, res) => {
  try {
    const { 
      doctorId, 
      patientId, 
      appointmentDate, 
      appointmentTime,
      serviceType,
      notes 
    } = req.body;

    // Validate required fields
    if (!doctorId || !appointmentDate || !appointmentTime || !serviceType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    // Generate unique booking ID
    const bookingId = `BOOK-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const booking = {
      bookingId,
      doctorId,
      pasienId: patientId || req.user.uid,
      appointmentDate,
      appointmentTime,
      serviceType,
      notes,
      status: 'pending', // pending, confirmed, cancelled, completed
      paymentStatus: 'unpaid', // unpaid, paid, refunded
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('bookings').doc(bookingId).set(booking);

    res.status(201).json({ 
      success: true, 
      data: booking 
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ success: false, error: 'Failed to create booking' });
  }
});

// Get all bookings for a user
router.get('/bookings', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const bookingsRef = db.collection('bookings');
    const snapshot = await bookingsRef
      .where('pasienId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    const bookings = [];
    snapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    res.json({ success: true, data: bookings });
  } catch (error) {
    console.error('Error getting bookings:', error);
    res.status(500).json({ success: false, error: 'Failed to get bookings' });
  }
});

// Get booking by ID
router.get('/bookings/:id', verifyToken, async (req, res) => {
  try {
    const bookingDoc = await db.collection('bookings').doc(req.params.id).get();
    
    if (!bookingDoc.exists) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Check if user has access to this booking
    const booking = bookingDoc.data();
    if (booking.pasienId !== req.user.uid) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, data: { id: bookingDoc.id, ...booking } });
  } catch (error) {
    console.error('Error getting booking:', error);
    res.status(500).json({ success: false, error: 'Failed to get booking' });
  }
});

// Update booking status
router.patch('/bookings/:id/status', verifyToken, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const bookingRef = db.collection('bookings').doc(req.params.id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Check if user has access to this booking
    const booking = bookingDoc.data();
    if (booking.pasienId !== req.user.uid) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (status) {
      if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }
      updateData.status = status;
    }

    if (paymentStatus) {
      if (!['unpaid', 'Berhasil', 'refunded'].includes(paymentStatus)) {
        return res.status(400).json({ success: false, error: 'Invalid payment status' });
      }
      updateData.paymentStatus = paymentStatus;
    }

    await bookingRef.update(updateData);
    const updatedBooking = await bookingRef.get();

    res.json({ 
      success: true, 
      data: { id: updatedBooking.id, ...updatedBooking.data() } 
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ success: false, error: 'Failed to update booking status' });
  }
});

module.exports = router; 