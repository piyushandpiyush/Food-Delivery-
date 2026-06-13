import amqp from "amqplib";

let channel: amqp.Channel;

const RECONNECT_DELAY_MS = 5000;

const channelReadyListeners: ((channel: amqp.Channel) => void)[] = [];

// Re-runs every callback whenever a (re)connect produces a new channel,
// so consumers don't stay bound to a dead channel after a reconnect.
export const onChannelReady = (cb: (channel: amqp.Channel) => void) => {
  channelReadyListeners.push(cb);
  if (channel) cb(channel);
};

export const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL!);

    connection.on("error", (err) => {
      console.error("RabbitMQ connection error (rider service):", err.message);
    });

    connection.on("close", () => {
      console.error("RabbitMQ connection closed (rider service). Reconnecting...");
      setTimeout(connectRabbitMQ, RECONNECT_DELAY_MS);
    });

    channel = await connection.createChannel();

    await channel.assertQueue(process.env.RIDER_QUEUE!, {
      durable: true,
    });
    await channel.assertQueue(process.env.ORDER_READY_QUEUE!, {
      durable: true,
    });

    console.log("🐇 connected To Rabbitmq(rider service)");

    channelReadyListeners.forEach((cb) => cb(channel));
  } catch (err) {
    console.error("Failed to connect to RabbitMQ (rider service). Retrying...", err);
    setTimeout(connectRabbitMQ, RECONNECT_DELAY_MS);
  }
};

export const getChannel = () => channel;
