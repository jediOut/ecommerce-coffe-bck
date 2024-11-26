"use strict";

//@ts-ignore
const stripe = require("stripe")(process.env.STRIPE_KEY);

/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async create(ctx) {
    console.log("Request body:", ctx.request.body);
    const { products } = ctx.request.body;

    try {
      const lineItems = await Promise.all(
        products.map(async (product) => {
          const items = await strapi.service("api::product.product").find({
            filters: { id: product.id },
          });
          const item = items.results[0];
          if (!item) {
            throw new Error(`Product with id ${product.id} not found`);
          }
          return {
            price_data: {
              currency: "mxn",
              product_data: {
                name: item.productName,
              },
              unit_amount: Math.round(item.price * 100),
            },
            quantity: product.quantity || 1,
          };
        })
      );

      const session = await stripe.checkout.sessions.create({
        shipping_address_collection: { allowed_countries: ["MX"] },
        payment_method_types: ["card"],
        mode: "payment",
        success_url: `${process.env.CLIENT_URL}/success`,
        cancel_url: `${process.env.CLIENT_URL}/successError`,
        line_items: lineItems,
      });

      await strapi.service("api::order.order").create({
        data: { products, stripeId: session.id },
      });

      return { stripeSession: session };
    } catch (error) {
      console.error("Error creating order:", error.message);
      ctx.response.status = 500;
      return { error: error.message };
    }
  },
}));
