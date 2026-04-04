import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { 
    joinVoiceChannel, 
    getVoiceConnection, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus,
    entersState,
    VoiceConnectionStatus
} from '@discordjs/voice';
import play from 'play-dl';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

// ===== QUEUE =====
const queues = new Map();

// ===== COMMAND =====
const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Phát nhạc')
        .addStringOption(opt =>
            opt.setName('url').setDescription('Link YouTube').setRequired(true)
        ),

    new SlashCommandBuilder().setName('skip').setDescription('Bỏ bài'),
    new SlashCommandBuilder().setName('stop').setDescription('Dừng nhạc'),
    new SlashCommandBuilder().setName('queue').setDescription('Xem danh sách'),
    new SlashCommandBuilder().setName('leave').setDescription('Rời voice')
].map(cmd => cmd.toJSON());

// ===== REGISTER =====
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
        console.log('✅ Commands ready');
    } catch (err) {
        console.error(err);
    }
})();

// ===== READY =====
client.once('clientReady', () => {
    console.log(`✅ Bot online: ${client.user.tag}`);
});

// ===== PLAY NEXT =====
async function playNext(guildId) {
    const queue = queues.get(guildId);
    if (!queue || queue.songs.length === 0) return;

    const song = queue.songs[0];

    const stream = await play.stream(song.url);

    const resource = createAudioResource(stream.stream, {
        inputType: stream.type
    });

    queue.player.play(resource);

    queue.player.once(AudioPlayerStatus.Idle, () => {
        queue.songs.shift();
        playNext(guildId);
    });
}

// ===== HANDLE COMMAND =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guild, member } = interaction;

    // ===== PLAY =====
    if (commandName === 'play') {
        const url = interaction.options.getString('url');
        const channel = member.voice.channel;

        if (!channel) return interaction.reply('❌ Vào voice trước!');

        let queue = queues.get(guild.id);

        if (!queue) {
            const player = createAudioPlayer();

            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator
            });

            connection.subscribe(player);

            // anti disconnect
            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch {
                    connection.destroy();
                }
            });

            queue = {
                player,
                songs: []
            };

            queues.set(guild.id, queue);
        }

        queue.songs.push({ url });

        if (queue.songs.length === 1) {
            playNext(guild.id);
        }

        return interaction.reply('🎵 Đã thêm vào queue');
    }

    // ===== SKIP =====
    if (commandName === 'skip') {
        const queue = queues.get(guild.id);
        if (!queue) return interaction.reply('❌ Không có nhạc');

        queue.player.stop();
        return interaction.reply('⏭ Đã skip');
    }

    // ===== STOP =====
    if (commandName === 'stop') {
        const queue = queues.get(guild.id);
        if (!queue) return interaction.reply('❌ Không có nhạc');

        queue.songs = [];
        queue.player.stop();

        return interaction.reply('⏹ Đã dừng');
    }

    // ===== QUEUE =====
    if (commandName === 'queue') {
        const queue = queues.get(guild.id);
        if (!queue || queue.songs.length === 0)
            return interaction.reply('📭 Queue trống');

        const list = queue.songs.map((s, i) => `${i + 1}. ${s.url}`).join('\n');

        return interaction.reply(`📜 Queue:\n${list}`);
    }

    // ===== LEAVE =====
    if (commandName === 'leave') {
        const connection = getVoiceConnection(guild.id);
        if (connection) connection.destroy();

        queues.delete(guild.id);

        return interaction.reply('👋 Bot đã rời');
    }
});

// ===== ANTI CRASH =====
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

client.login(process.env.TOKEN);
