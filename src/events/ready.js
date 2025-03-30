const { Events, EmbedBuilder } = require('discord.js');
const db = require('croxydb');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`🚀 ${client.user.tag} is ready!`);

    setInterval(async () => {
      const guilds = client.guilds.cache.map(guild => guild.id);
      
      for (const guildId of guilds) {
        const giveaways = db.get(`giveaways_${guildId}`) || [];
        const updatedGiveaways = [...giveaways];
        let hasChanges = false;

        for (let i = 0; i < giveaways.length; i++) {
          const giveaway = giveaways[i];
          
          if (!giveaway.ended && giveaway.endAt <= Date.now()) {
            try {
              const channel = await client.channels.fetch(giveaway.channelId);
              if (!channel) continue;

              const message = await channel.messages.fetch(giveaway.messageId);
              if (!message) continue;

              const winners = giveaway.participants
                .sort(() => Math.random() - 0.5)
                .slice(0, giveaway.winnerCount);

              updatedGiveaways[i] = {
                ...giveaway,
                ended: true,
                winners
              };
              hasChanges = true;

              const endEmbed = new EmbedBuilder()
                .setTitle('🎉 Çekiliş Sona Erdi!')
                .setColor('#FF69B4')
                .setDescription(giveaway.description)
                .addFields(
                  { name: '🎁 Ödül', value: giveaway.prize, inline: true },
                  { name: '👥 Kazanan Sayısı', value: giveaway.winnerCount.toString(), inline: true },
                  { name: '🎯 Toplam Katılımcı', value: giveaway.participants.length.toString(), inline: true },
                  { name: '👑 Kazananlar', value: winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'Kazanan yok!' }
                )
                .setTimestamp();

              await message.edit({ embeds: [endEmbed] });

              if (winners.length > 0) {
                const congratsEmbed = new EmbedBuilder()
                  .setTitle('🎊 Tebrikler!')
                  .setColor('#00FF00')
                  .setDescription(`${winners.map(w => `<@${w}>`).join(', ')}\n**${giveaway.prize}** kazandınız!`);

                await channel.send({ embeds: [congratsEmbed] });
              } else {
                const noWinnerEmbed = new EmbedBuilder()
                  .setTitle('😢 Üzgünüz')
                  .setColor('#FF0000')
                  .setDescription('Yeterli katılımcı olmadığı için kazanan belirlenemedi!');

                await channel.send({ embeds: [noWinnerEmbed] });
              }
            } catch (error) {
              console.error('Çekiliş bitirme hatası:', error);
            }
          } else if (!giveaway.ended) {
            try {
              const channel = await client.channels.fetch(giveaway.channelId);
              if (!channel) continue;

              const message = await channel.messages.fetch(giveaway.messageId);
              if (!message) continue;

              const winRate = ((giveaway.winnerCount / (message.guild.memberCount - 1)) * 100).toFixed(2);

              const updatedEmbed = new EmbedBuilder()
                .setTitle('🎉 Çekiliş Devam Ediyor!')
                .setColor('#FF69B4')
                .setDescription(giveaway.description)
                .addFields(
                  { name: '🎁 Ödül', value: giveaway.prize, inline: true },
                  { name: '👥 Kazanan Sayısı', value: giveaway.winnerCount.toString(), inline: true },
                  { name: '📊 Kazanma Oranı', value: `${winRate}%`, inline: true },
                  { name: '⏰ Kalan Süre', value: `<t:${Math.floor(giveaway.endAt / 1000)}:R>`, inline: true },
                  { name: '🎯 Katılımcı Sayısı', value: giveaway.participants.length.toString(), inline: true },
                  { name: '👑 Çekilişi Başlatan', value: `<@${giveaway.hostedBy}>`, inline: true }
                )
                .setFooter({ text: 'Katılmak için 🎉 emojisine tıklayın!' })
                .setTimestamp();

              await message.edit({ embeds: [updatedEmbed] });
            } catch (error) {
              console.error('Çekiliş güncelleme hatası:', error);
            }
          }
        }

        if (hasChanges) {
          db.set(`giveaways_${guildId}`, updatedGiveaways);
        }
      }
    }, 10000); // Her 10 saniyede bir kontrol et
  }
};