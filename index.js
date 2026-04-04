import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, entersState, VoiceConnectionStatus } from '@discordjs/voice';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

// ===== COMMAND =====
const commands = [
    new SlashCommandBuilder()
        .setName('join')
        .setDescription('Gọi bot vào voice'),

    new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Cho bot rời voice')
].map(cmd => cmd.toJSON());

// ===== REGISTER COMMAND (FIX HIỆN NGAY) =====
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );
        console.log('✅ Đã đăng ký lệnh (guild)');
    } catch (err) {
        console.error(err);
    }
})();

// ===== READY =====
client.once('clientReady', () => {
    console.log(`✅ Bot online: ${client.user.tag}`);

    client.user.setPresence({
        activities: [{
            name: '🎧 /play để phát nhạc',
            type: 2 // LISTENING
        }],
        status: 'online'
    });
});

// ===== HANDLE COMMAND =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // ===== JOIN =====
    if (interaction.commandName === 'join') {
        const channel = interaction.member.voice.channel;

        if (!channel) {
            return interaction.reply('❌ Vào voice trước!');
        }

        const oldConnection = getVoiceConnection(interaction.guild.id);
        if (oldConnection) oldConnection.destroy();

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator
        });

        console.log('🔊 Bot vào room');

        // 🔥 Anti disconnect
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch {
                console.log('❌ reconnect...');
                joinVoiceChannel({
                    channelId: channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator
                });
            }
        });

        return interaction.reply('🔊 Bot đã vào!');
    }

    // ===== LEAVE =====
    if (interaction.commandName === 'leave') {
        const connection = getVoiceConnection(interaction.guild.id);

        if (!connection) {
            return interaction.reply('❌ Bot chưa vào!');
        }

        connection.destroy();
        return interaction.reply('👋 Bot đã out!');
    }
});

// ===== ANTI CRASH =====
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

client.login(process.env.TOKEN);
