const WhatsappSession = require('../models/whatsappSessionModel');
const MenuItem = require('../models/menuItemModel');
const Category = require('../models/categoryModel');
const WhatsappSender = require('./whatsappSender');
const RazorpayService = require('./razorpayService');

/**
 * Handle Business logic for the WhatsApp Ordering Bot
 */
class WhatsappBot {
  /**
   * Main entry point to process a message
   */
  async processMessage(phone, text, messageType, customerName) {
    let session = await WhatsappSession.findOne({ phone });

    // Initialize session if it doesn't exist
    if (!session) {
      session = new WhatsappSession({ phone, customerName, state: 'INIT' });
      await session.save();
    }

    // Capture customer name if provided from profile and missing in session
    if (customerName && !session.customerName) {
      session.customerName = customerName;
    }

    const currentState = session.state;
    console.log(`Processing WhatsApp [${phone}] State: ${currentState} Input: ${text}`);

    switch (currentState) {
      case 'INIT':
        return await this.handleInit(session, text);
      case 'BROWSING_MENU':
        return await this.handleBrowsingMenu(session, text);
      case 'SELECTING_ITEM':
        return await this.handleSelectItem(session, text);
      case 'COLLECTING_QUANTITY':
        return await this.handleCollectQuantity(session, text);
      case 'CART_REVIEW':
        return await this.handleCartReview(session, text);
      case 'COLLECTING_ADDRESS':
        return await this.handleCollectAddress(session, text);
      case 'PAYMENT_PENDING':
        return await this.handlePaymentPending(session, text);
      case 'ORDER_CONFIRMED':
        return await this.handleOrderConfirmed(session , text);
      case 'AWAITING_FEEDBACK':
        return await this.handleAwaitingFeedback(session, text);
      default:
        return await this.handleInit(session, text);
    }
  }

  async handleInit(session, text) {
    session.state = 'BROWSING_MENU';
    await session.save();

    const greeting = session.customerName ? `Hello ${session.customerName}! ` : 'Hello! ';
    const message = `${greeting}Welcome to NextGenFix. 🍔🍟\nReady to place an order?`;
    
    await WhatsappSender.sendButtons(session.phone, message, [
      { id: 'view_menu', title: 'View Menu 🍽️' }
    ]);
  }

  async handleBrowsingMenu(session, text) {
    // If user clicked "View Menu" or similar
    if (text.toLowerCase().includes('menu') || text === 'view_menu') {
      const categories = await Category.find({ isActive: true }).sort('displayOrder');

      if (categories.length === 0) {
        await WhatsappSender.sendText(session.phone, "Sorry, our menu is currently being updated. Please check back later!");
        return;
      }

      const sections = [{
        title: "Available Categories",
        rows: categories.map(cat => ({
          id: `cat_${cat._id}`,
          title: cat.name,
          description: cat.description || ""
        }))
      }];

      session.state = 'SELECTING_ITEM';
      await session.save();

      await WhatsappSender.sendList(session.phone, "Select a category to see items:", "View Categories", sections);
    } else {
      // Re-prompt
      await WhatsappSender.sendButtons(session.phone, "Click below to see our menu!", [
        { id: 'view_menu', title: 'View Menu 🍽️' }
      ]);
    }
  }

  async handleSelectItem(session, text) {
    // If it's a category selection (cat_ID)
    if (text.startsWith('cat_')) {
      const categoryId = text.split('_')[1];
      const items = await MenuItem.find({ category: categoryId, isAvailable: true }).limit(10);

      if (items.length === 0) {
        await WhatsappSender.sendText(session.phone, "No items available in this category. Try another!");
        return; // Retain SELECTING_ITEM state to let them try another category
      }

      const sections = [{
        title: "Items",
        rows: items.map(item => ({
          id: `item_${item._id}`,
          title: item.name,
          description: `₹${item.price} - ${item.description?.text?.substring(0, 50) || ""}`
        }))
      }];

      // Button back to categories
      await WhatsappSender.sendList(session.phone, "Pick an item to add to your cart:", "Select Item", sections);
      return;
    }

    // If it's an item selection (item_ID)
    if (text.startsWith('item_')) {
      const itemId = text.split('_')[1];
      const item = await MenuItem.findById(itemId);

      if (!item) {
        await WhatsappSender.sendText(session.phone, "Item not found. Please try again!");
        return;
      }

      session.pendingItem = {
        itemId: item._id,
        name: item.name,
        price: item.price
      };
      session.state = 'COLLECTING_QUANTITY';
      await session.save();

      await WhatsappSender.sendText(session.phone, `How many ${item.name} would you like? (Please enter a number, e.g. 2)`);
      return;
    }

    // User typed something else - help them back
    await WhatsappSender.sendText(session.phone, "Please select a category or item from the list provided.");
  }

  async handleCollectQuantity(session, text) {
    const qty = parseInt(text.trim());

    if (isNaN(qty) || qty <= 0) {
      await WhatsappSender.sendText(session.phone, "Please enter a valid quantity (number greater than 0).");
      return;
    }

    // Add to cart
    const item = session.pendingItem;
    session.cart.push({
      itemId: item.itemId,
      name: item.name,
      price: item.price,
      quantity: qty
    });

    session.pendingItem = null;
    session.state = 'CART_REVIEW';
    await session.save();

    await this.sendCartSummary(session);
  }

  async sendCartSummary(session) {
    let summary = "*Your Cart:*\n\n";
    let total = 0;

    session.cart.forEach((item, index) => {
      const sub = item.price * item.quantity;
      summary += `${index + 1}. ${item.name} x ${item.quantity} = ₹${sub}\n`;
      total += sub;
    });

    summary += `\n*Total: ₹${total}*`;

    await WhatsappSender.sendButtons(session.phone, summary, [
      { id: 'add_more', title: 'Add More Items ➕' },
      { id: 'checkout', title: 'Place Order ✅' }
    ]);
  }

  async handleCartReview(session, text) {
    if (text === 'add_more') {
      session.state = 'BROWSING_MENU';
      await session.save();
      return await this.handleBrowsingMenu(session, 'view_menu');
    }

    if (text === 'checkout') {
      session.state = 'COLLECTING_ADDRESS';
      await session.save();
      await WhatsappSender.sendText(session.phone, "Great! Please provide your delivery address:");
      return;
    }

    await this.sendCartSummary(session);
  }

  async handleCollectAddress(session, text) {
    if (text.length < 5) {
      await WhatsappSender.sendText(session.phone, "Please provide a more detailed address.");
      return;
    }

    session.address = text;
    session.state = 'PAYMENT_PENDING';
    await session.save();

    const total = session.cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    await WhatsappSender.sendButtons(session.phone, `Confirm order for ₹${total} to be delivered to:\n\n${text}`, [
      { id: 'pay_now', title: 'Pay Online & Confirm 💳' },
      { id: 'cancel', title: 'Cancel ❌' }
    ]);
  }

  async handlePaymentPending(session, text) {
    if (text === 'pay_now') {
      const total = session.cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      
      try {
        const link = await RazorpayService.createPaymentLink(
          session.phone,
          total,
          `Order for ${session.customerName || 'WhatsApp User'}`,
          {
            phone: session.phone,
            customerName: session.customerName,
            address: session.address
          }
        );

        session.razorpayLinkId = link.id;
        await session.save();

        await WhatsappSender.sendText(session.phone, `Please pay ₹${total} using this link to confirm your order: ${link.short_url}\n\nWe will start preparing your meal as soon as payment is confirmed! 👨‍🍳`);
      } catch (error) {
        await WhatsappSender.sendText(session.phone, "Sorry, we had trouble creating your payment link. Please try again in a few moments or contact support.");
      }
      return;
    }

    if (text === 'cancel') {
        session.cart = [];
        session.address = null;
        session.state = 'INIT';
        await session.save();
        await WhatsappSender.sendText(session.phone, "Order cancelled. Send 'Hello' to start again!");
        return;
    }

    // If they just message while payment is pending, remind them
    const total = session.cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    await WhatsappSender.sendButtons(session.phone, "Awaiting payment to confirm your order.", [
        { id: 'pay_now', title: 'Pay Online Now 💳' }
    ]);
  }

  async handleOrderConfirmed(session, text) {
    // If they message after confirmation but before feedback session expired
    await WhatsappSender.sendText(session.phone, `Your order # ${session.orderId ? session.orderId.toString().slice(-6) : ""} is already confirmed! 🍕 It will be delivered shortly.`);
  }

  async handleAwaitingFeedback(session, text) {
    // Collect feedback and end
    session.state = 'INIT'; // Or some END state
    await session.save();
    await WhatsappSender.sendText(session.phone, "Thank you for your feedback! Hope to see you again soon. 👋");
  }
}

module.exports = new WhatsappBot();
