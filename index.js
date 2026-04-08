import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { 
    joinVoiceChannel, 
    getVoiceConnection, 
    entersState, 
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    StreamType
} from '@discordjs/voice';
import play from 'play-dl';
import ffmpeg from 'ffmpeg-static';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

// ===== COMMAND =====
const commands = [
    new SlashCommandBuilder()
        .setName('chill')
        .setDescription('Gọi bot vào voice'),

    new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Cho bot rời voice'),

    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Phát nhạc YouTube')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Link YouTube')
                .setRequired(true)
        )

].map(cmd => cmd.toJSON());

// ===== REGISTER COMMAND =====
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
});

// ===== HANDLE COMMAND =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // ===== JOIN =====
    if (interaction.commandName === 'chill') {
        const channel = interaction.member.voice.channel;

        if (!channel) {
            return interaction.reply('❌ Vào voice trước!');
        }

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator
        });

        return interaction.reply('🔊 Bot đã vào voice!');
    }

    // ===== PLAY =====
    if (interaction.commandName === 'play') {
        const url = interaction.options.getString('url');
        const channel = interaction.member.voice.channel;
    
        if (!channel) {
            return interaction.reply('❌ Vào voice trước!');
        }
    
        // 🔥 QUAN TRỌNG
        await interaction.deferReply();
    
        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator
            });
    
            const stream = await play.stream(url, {
                discordPlayerCompatibility: true
            });
    
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type
            });
    
            const player = createAudioPlayer();
    
            player.play(resource);
            connection.subscribe(player);
    
            await interaction.editReply('🎶 Đang phát nhạc...');
    
        } catch (err) {
            console.error(err);
            await interaction.editReply('❌ Lỗi phát nhạc!');
        }
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
