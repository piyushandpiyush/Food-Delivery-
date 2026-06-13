import { Request, Response } from "express";
import axios from "axios";
import { razorpay } from "../config/razorpay.js";
import { verifyRazorpaySignature } from "../config/verifyRazorpay.js";
import { publishPaymentSuccess } from "../config/payment.producer.js";

export const createRazorpayOrder = async (req: Request, res: Response) => {
  const { orderId } = req.body;

  const { data } = await axios.get(
    `${process.env.RESTAURANT_SERVICE}/api/order/payment/${orderId}`,
    {
      headers: {
        "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
      },
    }
  );

  const razorpayOrder = await razorpay.orders.create({
    amount: data.amount * 100,
    currency: "INR",
    receipt: orderId,
  });

  res.json({
    razorpayOrderId: razorpayOrder.id,
    key: process.env.RAZORPAY_KEY_ID,
  });
};

export const verifyRazorpayPayment = async (req: Request, res: Response) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    orderId,
  } = req.body;

  console.log("verifyRazorpayPayment called for orderId:", orderId);

  const isValid = verifyRazorpaySignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );

  console.log("Razorpay signature valid:", isValid);

  if (!isValid) {
    return res.status(400).json({
      message: "Payment verification failed",
    });
  }

  try {
    await publishPaymentSuccess({
      orderId,
      paymentId: razorpay_payment_id,
      provider: "razorpay",
    });

    console.log("PAYMENT_SUCCESS published for orderId:", orderId);

    res.json({
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error("Failed to publish PAYMENT_SUCCESS:", error);
    res.status(500).json({
      message: "Payment verified but failed to notify order service",
    });
  }
};

import dotenv from "dotenv";

dotenv.config();

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const payWithStripe = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;

    const { data } = await axios.get(
      `${process.env.RESTAURANT_SERVICE}/api/order/payment/${orderId}`,
      {
        headers: {
          "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
        },
      }
    );

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: "Tomato food order",
            },
            unit_amount: data.amount * 100,
          },
          quantity: 1,
        },
      ],

      metadata: {
        orderId,
      },

      success_url: `${process.env.FRONTEND_URL}/ordersuccess?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/checkout`,
    });

    res.json({
      url: session.url,
    });
  } catch (error) {
    res.status(500).json({
      message: "stripe payment failed",
    });
  }
};

export const verifyStripe = async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  console.log("verifyStripe called for sessionId:", sessionId);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(400).json({
        message: "Payment verifcation failed",
      });
    }

    console.log("Stripe session payment_status:", session.payment_status);

    const orderId = session.metadata?.orderId;

    if (!orderId) {
      return res.status(400).json({
        message: "orderid not found in stripe session",
      });
    }

    await publishPaymentSuccess({
      orderId,
      paymentId: sessionId,
      provider: "stripe",
    });

    console.log("PAYMENT_SUCCESS published for orderId:", orderId);

    res.json({
      message: "payment verified successfully",
    });
  } catch (error) {
    console.error("verifyStripe error:", error);
    res.status(500).json({
      message: "stripe payment failed",
    });
  }
};
