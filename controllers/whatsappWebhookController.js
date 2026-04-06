const WhatsappBot = require('../services/whatsappBot');
const WhatsappSession = require('../models/whatsappSessionModel');
const RazorpayService = require('../services/razorpayService');
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const WhatsappSender = require('../services/whatsappSender');
const mongoose = require('mongoose');

class WhatsappWebhookController {
  /**
   * Main entry for MSG91 "On Inbound Request Received" webhook
   */
  async handleInbound(req, res) {
    // Send 200 immediately to acknowledge receipt from MSG91
    res.status(200).json({ success: true });

    try {
      console.log('Incoming MSG91 Webhook Payload:', JSON.stringify(req.body, null, 2));

      const {
        customerNumber: phone,
        text,
        messageType,
        customerName,
        button,
        interactive
      } = req.body;

      if (!phone) return;

      // Decide what the actual message content is
      let input = text || "";
      
      // If user tapped a Quick Reply button 
      // MSG91 popup showed "button": "id" or title
      if (button) {
        // Button might be an object like { id: 'view_menu', text: 'View Menu 🍽️' }
        input = (typeof button === 'object' && button.id) ? button.id : button;
      }

      // If user selected from a List (interactive)
      if (interactive) {
        try {
          // interactive is a JSON string or object from MSG91
          const selection = typeof interactive === 'string' ? JSON.parse(interactive) : interactive;
          
          // In some cases, selection is the full 'interactive' object containing 'list_reply'
          if (selection?.id) {
            input = selection.id;
          } else if (selection?.list_reply?.id) {
            input = selection.list_reply.id;
          } else if (selection?.button_reply?.id) {
            input = selection.button_reply.id;
          }
        } catch (e) {
          console.error('Error parsing list selection:', e);
        }
      }

      // Check if current message is inside the 'messages' array (standard for some MSG91 versions)
      if (req.body.messages) {
        try {
          const msgs = typeof req.body.messages === 'string' ? JSON.parse(req.body.messages) : req.body.messages;
          if (Array.isArray(msgs) && msgs.length > 0) {
            const m = msgs[0];
            if (m.interactive) {
              if (m.interactive.list_reply?.id) input = m.interactive.list_reply.id;
              if (m.interactive.button_reply?.id) input = m.interactive.button_reply.id;
            } else if (m.text?.body) {
              if (!input) input = m.text.body;
            }
          }
        } catch (e) {
          console.error('Error parsing nested messages array:', e);
        }
      }

      console.log(`Processed Input for WhatsApp [${phone}]: "${input}"`);

      // Final processing
      await WhatsappBot.processMessage(phone, input, messageType, customerName);
    } catch (error) {
      console.error('handleInbound Webhook Error:', error);
    }
  }

  /**
   * Handle Razorpay Payment Webhook
   */
  async handleRazorpayWebhook(req, res) {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = JSON.stringify(req.body);

    if (!RazorpayService.verifyWebhookSignature(rawBody, signature)) {
      console.warn('Invalid Razorpay signature on WhatsApp webhook');
      return res.status(400).send('Invalid signature');
    }

    const { event, payload } = req.body;

    if (event === 'payment_link.paid') {
      const paymentLink = payload.payment_link.entity;
      const phone = paymentLink.customer.contact;

      try {
        const session = await WhatsappSession.findOne({ phone: phone.replace(/^\+/, '').replace(/\s+/g, '') });

        if (session && session.state === 'PAYMENT_PENDING') {
          // Create the actual order in DB
          const order = await this.createOrderFromSession(session, paymentLink.id);
          
          session.orderId = order._id;
          session.state = 'ORDER_CONFIRMED';
          await session.save();

          await WhatsappSender.sendText(session.phone, `Payment successful! ✅\nYour order #${order._id.toString().slice(-6)} has been placed and we've started preparing it. 👨‍🍳\nYou will receive a delivery update soon!`);
          
          // Trigger feedback 1 minute later (simulated/demo)
          // In production, use a proper scheduler like BullMQ or cron
          setTimeout(async () => {
            try {
              const currentSession = await WhatsappSession.findOne({ phone: session.phone });
              if (currentSession && currentSession.state === 'ORDER_CONFIRMED') {
                currentSession.state = 'AWAITING_FEEDBACK';
                await currentSession.save();
                await WhatsappSender.sendText(currentSession.phone, "How was your experience today? Rate us from 1 to 5 (or just reply with text)!");
              }
            } catch (err) {
              console.error('Error sending feedback prompt:', err);
            }
          }, 60000); 
        }
      } catch (err) {
        console.error('Error in handleRazorpayWebhook.payment_link.paid:', err);
      }
    }

    res.status(200).json({ success: true });
  }

  /**
   * Convert bot session into a final Order document
   */
  async createOrderFromSession(session, paymentId) {
    // 1. Find or create guest user
    let user = await User.findOne({ phone: session.phone });
    if (!user) {
      // Satisfy user record minimum reqs
      user = new User({
        phone: session.phone,
        name: session.customerName || 'WhatsApp User',
        role: 'user',
        isGuest: true // Flag to identify auto-created bot users
      });
      await user.save();
    }

    // 2. Map items to Order schema
    const orderItems = session.cart.map(item => ({
      itemId: item.itemId,
      name: item.name,
      quantity: item.quantity,
      price: item.price
    }));

    const total = session.cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    // 3. Create Order document
    const order = new Order({
      user: user._id,
      orderType: 'delivery', // Assuming delivery per plan
      items: orderItems,
      deliveryAddress: session.address,
      billing: {
        subtotal: total,
        totalAmount: total
      },
      status: 'placed',
      paymentStatus: 'paid',
      paymentDetails: {
        paymentId: paymentId,
        method: 'online',
        status: 'Completed'
      },
      trackingHistory: [{
        status: 'placed',
        notes: 'Order placed via WhatsApp Bot'
      }]
    });

    return await order.save();
  }
}

module.exports = new WhatsappWebhookController();
