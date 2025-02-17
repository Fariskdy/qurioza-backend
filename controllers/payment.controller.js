const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Enrollment = require("../models/enrollment.model");
const Course = require("../models/course.model");
const Batch = require("../models/batch.model");

// Add validation
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Stripe secret key is not configured");
}

// Create payment session
const createPaymentSession = async (batchId, userId) => {
  try {
    // Get batch and course details
    const batch = await Batch.findById(batchId).populate("course");
    if (!batch) {
      throw new Error("Batch not found");
    }

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: batch.course.title,
              description: `Batch #${batch.batchNumber}`,
              images: [batch.course.image],
            },
            unit_amount: Math.round(batch.course.price * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
      metadata: {
        batchId: batch._id.toString(),
        userId: userId,
        courseId: batch.course._id.toString(),
        price: batch.course.price.toString(),
      },
    });

    console.log("Created Stripe session with metadata:", session.metadata);

    return {
      sessionId: session.id,
    };
  } catch (error) {
    console.error("Payment session error:", error);
    throw error;
  }
};

// Create payment session route handler
const createPaymentSessionHandler = async (req, res) => {
  try {
    const result = await createPaymentSession(
      req.params.batchId,
      req.user.userId
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: "Error creating payment session",
      error: error.message,
    });
  }
};

// Verify payment webhook
const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log("Webhook event type:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      console.log("Payment session data:", {
        metadata: session.metadata,
        amount: session.amount_total,
        currency: session.currency,
      });

      try {
        // Create enrollment after successful payment
        const enrollment = await Enrollment.create({
          student: session.metadata.userId,
          batch: session.metadata.batchId,
          status: "active",
          payment: {
            status: "completed",
            stripePaymentId: session.payment_intent,
            stripeSessionId: session.id,
            amount: session.amount_total / 100, // Convert from cents
            currency: session.currency.toUpperCase(),
            paidAt: new Date(),
          },
        });

        console.log("Created enrollment:", enrollment._id);

        // Update course and batch stats
        await Promise.all([
          Course.findByIdAndUpdate(
            session.metadata.courseId,
            { $inc: { "stats.enrolledStudents": 1 } },
            { new: true }
          ),
          Batch.findByIdAndUpdate(
            session.metadata.batchId,
            { $inc: { enrollmentCount: 1 } },
            { new: true }
          ),
        ]);

        console.log("Updated course and batch stats");
      } catch (error) {
        console.error("Error processing webhook:", error);
        // Don't throw here - we want to return 200 to Stripe
        // but log the error for debugging
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

module.exports = {
  createPaymentSession,
  createPaymentSessionHandler,
  handleWebhook,
};
