const amqp = require('amqplib/callback_api');

async function startAdminCreationConsumer() {
    try {
        amqp.connect('amqp://triptixadmin:Justdoit007@triptix-rabbitmq-service:5672', (err, connection) => {
            if (err) {
                throw err;
            }
            console.log('Admin creation consumer connected');
            connection.createChannel((err, channel) => {
                if (err) {
                    throw err;
                }
                console.log('Admin creation consumer started');
                const exchangeName = 'admin_events'; // Use the same exchange name
                channel.assertExchange(exchangeName, 'fanout', { durable: false });
    
                channel.assertQueue('', { exclusive: true }, (err, queueInfo) => {
                    if (err) {
                        throw err;
                    }
                    channel.bindQueue(queueInfo.queue, exchangeName, '');
    
                    channel.consume(queueInfo.queue, (message) => {
                        if (message !== null) {
                            const adminData = JSON.parse(message.content.toString());
                            // Process the adminData in the air service
                            console.log('Received admin creation message:', adminData);
    
                            channel.ack(message); // Acknowledge the message
                        }
                    });
                });
            });
        });
    } catch (err) {
        console.error(err);
    }
}
//     const connection = await amqp.connect('amqp://triptixadmin:Justdoit007@triptix-rabbitmq-service.onrender.com:5672/triptixadmin');
//     const channel = await connection.createChannel();

//     const exchangeName = 'admin_events'; // Use the same exchange name
//     await channel.assertExchange(exchangeName, 'fanout', { durable: false });

//     const queueName = ''; // Let RabbitMQ generate a unique queue name
//     const queueInfo = await channel.assertQueue(queueName, { exclusive: true });
//     channel.bindQueue(queueInfo.queue, exchangeName, '');

//     channel.consume(queueInfo.queue, (message) => {
//         if (message !== null) {
//             const adminData = JSON.parse(message.content.toString());
//             // Process the adminData in the air service
//             console.log('Received admin creation message:', adminData);

//             channel.ack(message); // Acknowledge the message
//         }
//     });
// }

module.exports = startAdminCreationConsumer;
