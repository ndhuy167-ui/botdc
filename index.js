import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, entersState, VoiceConnectionStatus } from '@discordjs/voice';
import dotenv from 'dotenv';
import gTTS from 'gtts';
import fs from 'fs';
import { createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';

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
            name: '💖 Chỉ yêu mình Chill',
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

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!oldState.channel && newState.channel) {
        const channel = newState.channel;
        const user = newState.member.user;

        const text = `Chào mừng ${user.username} đã đến nhà của Huy với Chill`;

        const filePath = `./voice-${user.id}.mp3`;

        // tạo file giọng nói
        const gtts = new gTTS(text, 'vi');
        gtts.save(filePath, async function (err) {
            if (err) return console.log(err);

            // join voice
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: newState.guild.id,
                adapterCreator: newState.guild.voiceAdapterCreator
            });

            const player = createAudioPlayer();
            connection.subscribe(player);

            const resource = createAudioResource(filePath);
            player.play(resource);

            player.on(AudioPlayerStatus.Idle, () => {
                fs.unlinkSync(filePath); // xóa file sau khi phát
            });
        });
    }
});

client.login(process.env.TOKEN);
