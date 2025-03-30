const { Events, EmbedBuilder } = require('discord.js');
const ms = require('ms');
const db = require('croxydb');
const { parseTurkishDuration, formatDuration } = require('../utils/durationParser');
const { sendLog } = require('../utils/sendLog');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      if (interaction.isCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        await command.execute(interaction);
      } else if (interaction.isModalSubmit()) {
        if (interaction.customId === 'giveaway-modal') {
          const prize = interaction.fields.getTextInputValue('prize');
          const winners = parseInt(interaction.fields.getTextInputValue('winners'));
          const rawDuration = interaction.fields.getTextInputValue('duration');
          const description = interaction.fields.getTextInputValue('description');

          const duration = ms(parseTurkishDuration(rawDuration)) || ms(rawDuration);

          if (!duration) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor('#FF0000')
                  .setTitle('❌ Hata')
                  .setDescription('Geçersiz süre formatı!\nÖrnek: 1 gün 20 dakika, 1 hafta 5 dakika')
              ],
              ephemeral: true
            });
          }

          const giveaway = {
            messageId: '',
            channelId: interaction.channelId,
            guildId: interaction.guildId,
            startAt: Date.now(),
            endAt: Date.now() + duration,
            ended: false,
            winnerCount: winners,
            prize,
            description,
            hostedBy: interaction.user.id,
            winners: [],
            participants: []
          };

          const winRate = ((winners / (interaction.guild.memberCount - 1)) * 100).toFixed(2);

          const embed = new EmbedBuilder()
            .setTitle('🎉 Yeni Çekiliş Başladı!')
            .setColor('#FF69B4')
            .setDescription(description)
            .addFields(
              { name: '🎁 Ödül', value: prize, inline: true },
              { name: '👥 Kazanan Sayısı', value: winners.toString(), inline: true },
              { name: '📊 Kazanma Oranı', value: `${winRate}%`, inline: true },
              { name: '⏰ Kalan Süre', value: `<t:${Math.floor((Date.now() + duration) / 1000)}:R>`, inline: true },
              { name: '🎯 Katılımcı Sayısı', value: '0', inline: true },
              { name: '👑 Çekilişi Başlatan', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setFooter({ text: 'Katılmak için 🎉 emojisine tıklayın!' })
            .setTimestamp();

          const message = await interaction.channel.send({ embeds: [embed] });
          await message.react('🎉');
          giveaway.messageId = message.id;

          const giveaways = db.get(`giveaways_${interaction.guildId}`) || [];
          giveaways.push(giveaway);
          db.set(`giveaways_${interaction.guildId}`, giveaways);

          await sendLog(interaction.client, 'giveawayStart', giveaway);

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Başarılı')
                .setDescription('Çekiliş başarıyla başlatıldı!')
            ],
            ephemeral: true
          });
        } else if (interaction.customId === 'giveaway-stop-modal') {
          const giveawayId = interaction.fields.getTextInputValue('giveawayId');
          const determineWinners = interaction.fields.getTextInputValue('determineWinners').toLowerCase();

          if (determineWinners !== 'evet' && determineWinners !== 'hayır') {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor('#FF0000')
                  .setTitle('❌ Hata')
                  .setDescription('Lütfen "evet" veya "hayır" yazın!')
              ],
              ephemeral: true
            });
          }

          const giveaways = db.get(`giveaways_${interaction.guildId}`) || [];
          const giveawayIndex = giveaways.findIndex(g => g.messageId === giveawayId && !g.ended);

          if (giveawayIndex === -1) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor('#FF0000')
                  .setTitle('❌ Hata')
                  .setDescription('Belirtilen ID ile aktif bir çekiliş bulunamadı!')
              ],
              ephemeral: true
            });
          }

          const giveaway = giveaways[giveawayIndex];
          giveaway.ended = true;

          let winners = [];
          if (determineWinners === 'evet') {
            winners = giveaway.participants
              .sort(() => Math.random() - 0.5)
              .slice(0, giveaway.winnerCount);
          }

          giveaway.winners = winners;
          giveaways[giveawayIndex] = giveaway;
          db.set(`giveaways_${interaction.guildId}`, giveaways);

          const channel = interaction.guild.channels.cache.get(giveaway.channelId);
          const message = await channel.messages.fetch(giveaway.messageId);

          const endEmbed = new EmbedBuilder()
            .setTitle('🎉 Çekiliş Sona Erdi!')
            .setColor('#FF69B4')
            .setDescription(giveaway.description)
            .addFields(
              { name: '🎁 Ödül', value: giveaway.prize, inline: true },
              { name: '👥 Kazanan Sayısı', value: giveaway.winnerCount.toString(), inline: true },
              { name: '🎯 Toplam Katılımcı', value: giveaway.participants.length.toString(), inline: true }
            )
            .setTimestamp();

          if (determineWinners === 'evet') {
            endEmbed.addFields({
              name: '👑 Kazananlar',
              value: winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'Kazanan yok!'
            });
          } else {
            endEmbed.addFields({
              name: '📝 Not',
              value: 'Çekiliş kazanan belirlenmeden sonlandırıldı.'
            });
          }

          await message.edit({ embeds: [endEmbed] });

          await sendLog(interaction.client, 'giveawayEnd', {
            ...giveaway,
            endedBy: interaction.user.id
          });

          if (determineWinners === 'evet' && winners.length > 0) {
            const congratsEmbed = new EmbedBuilder()
              .setTitle('🎊 Tebrikler!')
              .setColor('#00FF00')
              .setDescription(`${winners.map(w => `<@${w}>`).join(', ')}\n**${giveaway.prize}** kazandınız!`);

            await channel.send({ embeds: [congratsEmbed] });
          }

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Başarılı')
                .setDescription(`Çekiliş başarıyla durduruldu!${determineWinners === 'evet' ? ' Kazananlar belirlendi!' : ''}`)
            ],
            ephemeral: true
          });
        }
      }
    } catch (error) {
      console.error('Interaction error:', error);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Hata')
            .setDescription('Bir hata oluştu!')
        ],
        ephemeral: true
      });
    }
  }
};