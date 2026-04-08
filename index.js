import { Client, GatewayIntentBits } from 'discord.js';
import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    entersState,
    VoiceConnectionStatus,
    getVoiceConnection
} from '@discordjs/voice';
import play from 'play-dl';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once("ready", () => {
    console.log(`✅ Bot ready`);
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // ===== PLAY =====
    if (message.content.startsWith("!play")) {
        const url = message.content.split(" ")[1];

        if (!url) return message.reply("❌ Nhập link YouTube");

        const vc = message.member.voice.channel;
        if (!vc) return message.reply("❌ Vào voice trước");

        try {
            const connection = joinVoiceChannel({
                channelId: vc.id,
                guildId: vc.guild.id,
                adapterCreator: vc.guild.voiceAdapterCreator,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 30000);

            console.log("🎶 Playing:", url);

            const stream = await play.stream(url);

            const resource = createAudioResource(stream.stream, {
                inputType: stream.type
            });

            const player = createAudioPlayer();

            connection.subscribe(player);
            player.play(resource);

            player.on(AudioPlayerStatus.Playing, () => {
                console.log("✅ Đang phát");
            });

            player.on("error", err => {
                console.error("❌ Player lỗi:", err);
            });

        } catch (err) {
            console.error(err);
            message.reply("❌ Lỗi phát nhạc");
        }
    }

    // ===== STOP =====
    if (message.content === "!stop") {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
            message.reply("⏹️ Đã dừng");
        }
    }
});

// ⚠️ DÁN TOKEN TRỰC TIẾP ĐỂ TEST
client.login("DÁN_TOKEN_VÀO_ĐÂY");
