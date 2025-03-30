const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadCommands } = require('./src/handlers/commandHandler');
const { loadEvents } = require('./src/handlers/eventHandler');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

client.commands = new Collection();

(async () => {
  try {
    await loadCommands(client);
    console.log('🔥 Komutlar başarıyla yüklendi!');
    
    await loadEvents(client);
    console.log('⚡ Etkinlikler başarıyla yüklendi!');
    
    await client.login(process.env.TOKEN);
  } catch (error) {
    console.error('❌ Başlatma sırasında hata:', error);
  }
})();