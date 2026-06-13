import amqp from "amqplib";

let channel: amqp.Channel;

const RECONNECT_DELAY_MS = 5000;

export const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL!);

    connection.on("error", (err) => {
      console.error("RabbitMQ connection error (utils service):", err.message);
    });

    connection.on("close", () => {
      console.error("RabbitMQ connection closed (utils service). Reconnecting...");
      setTimeout(connectRabbitMQ, RECONNECT_DELAY_MS);
    });

    channel = await connection.createChannel();

    await channel.assertQueue(process.env.PAYMENT_QUEUE!, {
      durable: true,
    });

    console.log("🐇 connected To Rabbitmq");
  } catch (err) {
    console.error("Failed to connect to RabbitMQ (utils service). Retrying...", err);
    setTimeout(connectRabbitMQ, RECONNECT_DELAY_MS);
  }
};

export const getChannel = () => channel;
