const { Telegraf } = require("telegraf");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs").promises;
const path = require("path");
const ytdl = require("ytdl-core");
const cheerio = require("cheerio");
const { exec } = require("child_process");

// --- ⚙️ PUSAT KONFIGURASI & KUNCI API ⚙️ --- //
const BOT_TOKEN = process.env.BOT_TOKEN || "8021784210:AAFf6UO4T9lHP66VySh5GDTh0qdv5mjZQG0";
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || "060a6bcfa19809c2cd4d97a212b19273";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyAuKMjIfDVFm4Y5LN8YNoE8G4f4eBVZHH1";
// PENTING: Masukkan API Key dari Google Cloud untuk YouTube di sini!
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "MASUKKAN_YOUTUBE_API_KEY_DISINI"; 
const HITORI_API_KEY = "htrkey-77eb83c0eeb39d40";

// --- 🖼️ DATA & LOKASI FILE 🖼️ --- //
const menuImages = ["https://i.waifu.pics/dPXxQqE.png", "https://i.waifu.pics/3pFDfnw.png", "https://i.waifu.pics/3pFDfnw.png"];
const DATA_DIR = path.join(__dirname, "data");
const CONVERSATIONS_DIR = path.join(DATA_DIR, "conversations");
const TEMP_DIR = path.join(__dirname, "temp");

// --- 🧠 FUNGSI DATABASE (Untuk Memori AI) 🧠 --- //
async function initDatabase() {
    try {
        await fs.mkdir(CONVERSATIONS_DIR, { recursive: true });
        await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (error) {
        console.error("Gagal membuat folder data/temp:", error);
    }
}
async function loadConversation(userId) {
    const filePath = path.join(CONVERSATIONS_DIR, `${userId}.json`);
    try { 
        const data = await fs.readFile(filePath, "utf8");
        return JSON.parse(data); 
    } catch (error) { 
        return []; 
    }
}
async function saveConversation(userId, history) {
    const filePath = path.join(CONVERSATIONS_DIR, `${userId}.json`);
    await fs.writeFile(filePath, JSON.stringify(history, null, 2), "utf8");
}

// --- 🤖 INISIALISASI BOT & API HELPER 🤖 --- //
const bot = new Telegraf(BOT_TOKEN);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const hitoriApi = axios.create({ baseURL: "https://api.hitori.pw", params: { "apikey": HITORI_API_KEY } });
const someRandomApi = axios.create({ baseURL: "https://some-random-api.com" });


// --- 🌟 MENU UTAMA (/start & /help) 🌟 --- //
const welcomeMessage = `✨ *Selamat Datang di Bot Legendaris!*
Bot serbaguna dengan puluhan fitur canggih. Pilih menu di bawah dan nikmati semua fiturnya! 🔥`;

const menuDownloader = `📥 *MENU DOWNLOADER*
- /tiktok <link> — Download Video TikTok
- /spotifydl <link> — Download Lagu Spotify
- /mediafire <link> — Download File MediaFire
- /play <judul> — Play Lagu YouTube`;

const menuAICreative = `🎨 *MENU AI & KREATIF*
- /imagine <teks> — Gambar AI Unik
- /remini — Tingkatkan Kualitas Foto
- /qc <teks> — Stiker Chat Palsu
- /smeme <a|b> — Stiker Meme
- /wasted — Efek Meme Wasted
- /triggered — GIF Triggered`;

const menuStickerFun = `🎭 *MENU STIKER & FUN*
- /sticker — Ubah Gambar ke Stiker
- /emojimix <a+b> — Gabungkan Emoji
- /brat <teks> — Teks Stiker Lucu
- /bratvid <teks> — Video Teks Efek
- /dadu — Lempar Dadu
- /cekmati <nama> — Tes "Nasib" Kamu`;

const menuSearchInfo = `🔍 *MENU PENCARIAN & INFO*
- /ai <pesan> — Chat dengan AI
- /reset — Reset AI Memory
- /stalk <link> — Stalk Instagram
- /ghstalk <user> — Stalk GitHub
- /spotify <lagu> — Info Lagu Spotify
- /urban <kata> — Arti Kata Gaul
- /tenor <gif> — Cari GIF Tenor
- /npm <paket> — Info NPM Package
- /ssweb <link> — Screenshot Website
- /cuaca <kota> — Info Cuaca`;

const menuTextContent = `✍️ *MENU TEKS & KONTEN*
- /quotes — Kutipan Acak
- /motivasi — Kata Motivasi
- /bucin — Kata Bucin Sadboy
- /style <teks> — Gaya Teks Keren
- /kopi — Gambar Kopi Estetik
- /meme — Meme Lucu
- /help — Tampilkan Menu Ini Lagi`;

const menuAnimeWaifu = `💖 *MENU ANIME & WAIFU*
- /waifu — Random Waifu Cantik
- /neko — Neko Imut Lucu
- /hd — Gambar HD Anime
- /nsfw — Gambar Anime Dewasa 🔞`;

const showMainMenu = async (ctx) => {
    try {
        const randomImage = menuImages[Math.floor(Math.random() * menuImages.length)];
        await ctx.replyWithPhoto(randomImage, {
            caption: welcomeMessage,
            parse_mode: "Markdown"
        });

        // Kirim semua menu
        await ctx.replyWithMarkdown(menuDownloader);
        await ctx.replyWithMarkdown(menuAICreative);
        await ctx.replyWithMarkdown(menuStickerFun);
        await ctx.replyWithMarkdown(menuSearchInfo);
        await ctx.replyWithMarkdown(menuTextContent);
        await ctx.replyWithMarkdown(menuAnimeWaifu);
        
    } catch (error) {
        console.error("❌ Error sending menu messages:", error);
        // Jika error, fallback ke teks biasa
        await ctx.replyWithMarkdown(welcomeMessage);
        await ctx.replyWithMarkdown(menuDownloader);
        await ctx.replyWithMarkdown(menuAICreative);
        await ctx.replyWithMarkdown(menuStickerFun);
        await ctx.replyWithMarkdown(menuSearchInfo);
        await ctx.replyWithMarkdown(menuTextContent);
        await ctx.replyWithMarkdown(menuAnimeWaifu);
    }
};

bot.start(showMainMenu);
bot.help(showMainMenu);


// --- 📥 IMPLEMENTASI FITUR DOWNLOADER 📥 --- //
bot.command("tiktok", async (ctx) => {
    const link = ctx.message.text.split(" ")[1];
    if (!link || !link.includes("tiktok.com")) return ctx.reply("❓ Penggunaan: `/tiktok <link video tiktok>`");
    const waitingMessage = await ctx.reply("📥 Mengunduh video TikTok...");
    try {
        const { data } = await hitoriApi.get("/download/tiktok", { params: { url: link } });
        await ctx.replyWithVideo(data.data.video, { caption: data.data.caption || "Done!" });
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Gagal mengunduh video.").catch(() => {});
    }
});

// /waifu
bot.command("waifu", async (ctx) => {
    try {
        await ctx.replyWithChatAction("upload_photo");
        const res = await axios.get(`https://api.waifu.pics/sfw/waifu`);
        await sendExpiringPhoto(ctx, res.data.url, `💖 Waifu untukmu!`);
    } catch (error) {
        ctx.reply("❌ Gagal mengambil gambar waifu.");
    }
});

// /neko
bot.command("neko", async (ctx) => {
    try {
        await ctx.replyWithChatAction("upload_photo");
        const res = await axios.get(`https://api.waifu.pics/sfw/neko`);
        await sendExpiringPhoto(ctx, res.data.url, `🐱 Neko-chan dataang!`);
    } catch (error) {
        ctx.reply("❌ Gagal mengambil gambar neko.");
    }
});

// /hd
bot.command("hd", async (ctx) => {
    try {
        await ctx.replyWithChatAction("upload_photo");
        const category = getRandomItem(hdCategories);
        const res = await axios.get(`https://api.waifu.pics/sfw/${category}`);
        await sendExpiringPhoto(ctx, res.data.url, `🖼️ Ini gambar HD untukmu! Kategori: *${category}*`);
    } catch (error) {
        ctx.reply("❌ Gagal mengambil gambar HD.");
    }
});

// /nsfw
bot.command("nsfw", async (ctx) => {
    if (ctx.chat.type !== "private") {
        return ctx.reply("🔞 Perintah ini hanya bisa digunakan di private chat.");
    }
    try {
        await ctx.replyWithChatAction("upload_photo");
        const category = getRandomItem(nsfwCategories);
        const res = await axios.get(`https://api.waifu.pics/nsfw/${category}`);
        await sendExpiringPhoto(ctx, res.data.url, `🔞 Kategori NSFW: *${category}*`);
    } catch (error) {
        ctx.reply("❌ Gagal mengambil gambar NSFW.");
    }
});

bot.command("spotifydl", async (ctx) => {
    const link = ctx.message.text.split(" ")[1];
    if (!link || !link.includes("spotify.com")) return ctx.reply("❓ Penggunaan: `/spotifydl <link lagu spotify>`");
    const waitingMessage = await ctx.reply("📥 Mengunduh lagu Spotify...");
    try {
        const { data } = await hitoriApi.get("/download/spotify", { params: { url: link } });
        await ctx.replyWithAudio({ url: data.data.url, filename: `${data.data.title}.mp3` }, {
            caption: `🎶 *${data.data.title}*\n🎤 Artis: ${data.data.artist}`,
            parse_mode: "Markdown"
        });
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Gagal mengunduh lagu.").catch(() => {});
    }
});

bot.command("mediafire", async (ctx) => {
    const link = ctx.message.text.split(" ")[1];
    if (!link || !link.includes("mediafire.com")) return ctx.reply("❓ Penggunaan: `/mediafire <link mediafire>`");
    const waitingMessage = await ctx.reply("📥 Mengunduh file dari MediaFire...");
    try {
        const { data } = await hitoriApi.get("/download/mediafire", { params: { url: link } });
        await ctx.replyWithDocument({ url: data.data.url, filename: data.data.filename }, {
            caption: `*${data.data.filename}* (${data.data.size})`,
            parse_mode: "Markdown"
        });
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Gagal mengunduh file.").catch(() => {});
    }
});

bot.command("play", async (ctx) => {
    if (YOUTUBE_API_KEY === "MASUKKAN_YOUTUBE_API_KEY_DISINI") return ctx.reply("❌ Fitur musik belum aktif. Silakan atur YOUTUBE_API_KEY.");
    const query = ctx.message.text.split(" ").slice(1).join(" ");
    if (!query) return ctx.reply("❓ Penggunaan: `/play <judul lagu>`");
    const waitingMessage = await ctx.reply(`🔍 Mencari lagu...`);
    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`;
        const { data } = await axios.get(searchUrl);
        if (!data.items.length) return ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Lagu tidak ditemukan.");
        const video = data.items[0];
        const videoId = video.id.videoId;
        const title = video.snippet.title;
        await ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, `✅ Lagu ditemukan!\n*${title}*\n\nMengunduh...`, { parse_mode: "Markdown" });
        const audioStream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, { filter: "audioonly", quality: "highestaudio" });
        await ctx.replyWithAudio({ source: audioStream, filename: `${title}.mp3` }, { caption: `🎶 *${title}*`, parse_mode: "Markdown" });
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Terjadi kesalahan saat memproses lagu.").catch(() => {});
    }
});


// --- 🎨 IMPLEMENTASI FITUR AI & KREATIF 🎨 --- //
bot.command("imagine", async (ctx) => {
    const query = ctx.message.text.split(" ").slice(1).join(" ");
    if (!query) return ctx.reply("❓ Penggunaan: `/imagine <deskripsi gambar>`");
    const waitingMessage = await ctx.reply("🎨 AI sedang melukis...");
    try {
        const { data } = await hitoriApi.get("/ai/stablediffusion", { params: { prompt: query } });
        await ctx.replyWithPhoto(data.data.url, { caption: `*Prompt:* ${query}`, parse_mode: "Markdown" });
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Gagal membuat gambar.").catch(() => {});
    }
});

bot.command("remini", async (ctx) => {
    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.photo) return ctx.reply("❓ Reply ke sebuah foto dengan perintah `/remini`");
    const waitingMessage = await ctx.reply("✨ Meningkatkan kualitas gambar...");
    try {
        const fileId = ctx.message.reply_to_message.photo.pop().file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);
        const { data } = await hitoriApi.get("/tools/remini", { params: { url: fileLink.href } });
        await ctx.replyWithDocument({ url: data.data.url, filename: "remini-hd.jpg" });
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Gagal meningkatkan kualitas.").catch(() => {});
    }
});

bot.command("qc", async (ctx) => {
    const text = ctx.message.text.split(" ").slice(1).join(" ");
    if (!text) return ctx.reply("❓ Penggunaan: `/qc <teks untuk quote>`");
    const waitingMessage = await ctx.reply("✍️ Membuat quote...");
    try {
        const userId = ctx.from.id;
        const name = ctx.from.first_name;
        let pfpUrl = "https://i.pinimg.com/564x/8a/e9/e9/8ae9e92fa4e69967aa61bf2bda967b7b.jpg";
        try {
            const pfp = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);
            if (pfp.total_count > 0) {
                const fileId = pfp.photos[0][0].file_id;
                pfpUrl = (await ctx.telegram.getFileLink(fileId)).href;
            }
        } catch (e) {}
        const { data } = await hitoriApi.get("/tools/qc", { params: { text, name, avatar: pfpUrl } });
        await ctx.replyWithSticker(data.data.url);
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Gagal membuat quote.").catch(() => {});
    }
});


bot.command("smeme", async (ctx) => {
    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.photo) return ctx.reply("❓ Reply ke sebuah foto dengan perintah `/smeme teks atas|teks bawah`");
    const text = ctx.message.text.split(" ").slice(1).join(" ");
    if (!text || !text.includes("|")) return ctx.reply("❓ Format salah. Contoh: `/smeme teks atas|teks bawah`");
    const [topText, bottomText] = text.split("|");
    const waitingMessage = await ctx.reply("😂 Membuat meme...");
    try {
        const fileId = ctx.message.reply_to_message.photo.pop().file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);
        const apiUrl = `https://api.memegen.link/images/custom/${encodeURIComponent(topText)}/${encodeURIComponent(bottomText)}.png?background=${fileLink.href}`;
        await ctx.replyWithSticker(apiUrl);
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Gagal membuat meme.").catch(() => {});
    }
});

const applyCanvas = async (ctx, canvasType) => {
    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.photo) return ctx.reply(`❓ Reply ke sebuah foto dengan perintah \`/${canvasType}\``);
    const waitingMessage = await ctx.reply("🎨 Menerapkan efek...");
    try {
        const fileId = ctx.message.reply_to_message.photo.pop().file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);
        const { data } = await someRandomApi.get(`/canvas/filters/${canvasType}`, { params: { avatar: fileLink.href }, responseType: "arraybuffer" });
        if (canvasType === "triggered") {
            await ctx.replyWithAnimation({ source: data });
        } else {
            await ctx.replyWithPhoto({ source: data });
        }
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Gagal menerapkan efek.").catch(() => {});
    }
};
bot.command("wasted", (ctx) => applyCanvas(ctx, "wasted"));
bot.command("triggered", (ctx) => applyCanvas(ctx, "triggered"));


// --- 🎭 IMPLEMENTASI FITUR STIKER & FUN 🎭 --- //
bot.command("sticker", async (ctx) => {
    if (!ctx.message.reply_to_message || (!ctx.message.reply_to_message.photo && !ctx.message.reply_to_message.sticker)) {
        return ctx.reply("❓ Reply ke sebuah foto/stiker dengan perintah `/sticker`");
    }
    const waitingMessage = await ctx.reply("✨ Membuat stiker...");
    try {
        const fileId = ctx.message.reply_to_message.photo ? ctx.message.reply_to_message.photo.pop().file_id : ctx.message.reply_to_message.sticker.file_id;
        await ctx.replyWithSticker(fileId);
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Gagal membuat stiker.").catch(() => {});
    }
});

bot.command("emojimix", async (ctx) => {
    const text = ctx.message.text.split(" ")[1];
    if (!text || !text.includes("+")) return ctx.reply("❓ Penggunaan: `/emojimix 😀+👻`");
    const [emoji1, emoji2] = text.split("+");
    const waitingMessage = await ctx.reply("🧑‍🍳 Mencampur emoji...");
    try {
        const { data } = await hitoriApi.get("/tools/emojimix", { params: { emoji1, emoji2 } });
        await ctx.replyWithSticker(data.data.url);
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Gagal mencampur emoji.").catch(() => {});
    }
});

bot.command("brat", async (ctx) => {
    const text = ctx.message.text.split(" ").slice(1).join(" ");
    if (!text) return ctx.reply("❓ Penggunaan: `/brat <teks kamu>`");
    try {
        await ctx.replyWithSticker(`https://aqul-brat.hf.space/?text=${encodeURIComponent(text)}`);
    } catch (error) {
        ctx.reply("❌ Gagal membuat stiker brat.");
    }
});

bot.command("bratvid", async (ctx) => {
    const text = ctx.message.text.split(" ").slice(1).join(" ");
    if (!text) return ctx.reply("❓ Penggunaan: `/bratvid <teks kamu>`");
    const waitingMessage = await ctx.reply("🎥 Membuat video tulisan...");
    const tempId = ctx.from.id + Date.now();
    try {
        const words = text.split(" ");
        const frames = [];
        for (let i = 0; i < words.length; i++) {
            const currentText = words.slice(0, i + 1).join(" ");
            const response = await axios.get(`https://aqul-brat.hf.space/?text=${encodeURIComponent(currentText)}`, { responseType: "arraybuffer" });
            const framePath = path.join(TEMP_DIR, `frame_${tempId}_${i}.png`);
            await fs.writeFile(framePath, response.data);
            frames.push(framePath);
        }
        const fileListPath = path.join(TEMP_DIR, `files_${tempId}.txt`);
        const fileListContent = frames.map(f => `file \'${f.replace(/\\/g, "/")}\'\nduration 0.5`).join("\n");
        await fs.writeFile(fileListPath, fileListContent);
        const outputPath = path.join(TEMP_DIR, `output_${tempId}.mp4`);
        exec(`ffmpeg -y -f concat -safe 0 -i "${fileListPath}" -vsync vfr -pix_fmt yuv420p "${outputPath}"`, async (error) => {
            if (error) {
                console.error("FFMPEG Error:", error);
                ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Gagal membuat video. Pastikan FFmpeg terinstall.").catch(() => {});
                return;
            }
            await ctx.replyWithAnimation({ source: outputPath });
            ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
            // Cleanup
            await Promise.all([...frames.map(f => fs.unlink(f)), fs.unlink(fileListPath), fs.unlink(outputPath)]).catch(console.error);
        });
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Gagal memproses video.").catch(() => {});
    }
});

bot.command("dadu", (ctx) => ctx.replyWithSticker(`https://www.random.org/dice/dice${Math.floor(Math.random() * 6) + 1}.png`));

bot.command("cekmati", async (ctx) => {
    const name = ctx.message.text.split(" ").slice(1).join(" ") || ctx.from.first_name;
    try {
        const { data } = await axios.get(`https://api.agify.io/?name=${name}`);
        ctx.reply(`*Nama:* ${name}\n*Prediksi Umur Kematian:* ${data.age || (Math.floor(Math.random() * 40) + 50)} tahun.\n\n_Cepatlah bertaubat, karena ajal tidak menunggu taubatmu._`, { parse_mode: "Markdown" });
    } catch (error) {
        ctx.reply("❌ Gagal meramal nasib.");
    }
});


// --- 🔍 IMPLEMENTASI FITUR PENCARIAN & INFO 🔍 --- //
bot.command("ai", async (ctx) => {
    const userId = ctx.from.id.toString();
    const userMessage = ctx.message.text.split(" ").slice(1).join(" ");
    if (!userMessage) return ctx.reply("❓ Penggunaan: `/ai <pertanyaan Anda>`");
    try {
        await ctx.replyWithChatAction("typing");
        const history = await loadConversation(userId);
        const chat = aiModel.startChat({ history });
        const result = await chat.sendMessage(userMessage);
        const text = result.response.text();
        await saveConversation(userId, await chat.getHistory());
        await ctx.reply(`*🤖 Gemini:* ${text}`, { parse_mode: "Markdown" });
    } catch (error) { ctx.reply("❌ Maaf, terjadi kesalahan pada fitur AI."); }
});

bot.command("reset", async (ctx) => {
    await saveConversation(ctx.from.id.toString(), []);
    await ctx.reply("🔄 Memori percakapan AI telah direset.");
});

bot.command("stalk", async (ctx) => {
    const link = ctx.message.text.split(" ")[1];
    if (!link || !link.startsWith("http")) return ctx.reply("❓ Penggunaan: `/stalk <link profil IG/TikTok/YouTube>`");
    const waitingMessage = await ctx.reply("🕵️ Meneropong profil...");
    try {
        const { data } = await hitoriApi.get("/tools/stalk", { params: { url: link } });
        const result = data.data;
        const resultMessage = `*${result.icon} Hasil Teropong ${result.platform}*\n\n👤 *Username:* \`${result.username}\`\n👥 *Jumlah:* \`${result.followers}\`\n\n*Sumber:* [Lihat Profil](${link})`;
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
        await ctx.reply(resultMessage, { parse_mode: "Markdown" });
    } catch (error) {
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
        ctx.reply("❌ Gagal mengambil data. Mungkin profil private atau link salah.");
    }
});


bot.command("ghstalk", async (ctx) => {
    const username = ctx.message.text.split(" ")[1];
    if (!username) return ctx.reply("❓ Penggunaan: `/ghstalk <username github>`");
    try {
        const { data } = await axios.get(`https://api.github.com/users/${username}`);
        const caption = `*Profil GitHub: ${data.login}*\n\n*Nama:* ${data.name || "N/A"}\n*Followers:* ${data.followers}\n*Following:* ${data.following}\n*Repo Publik:* ${data.public_repos}\n\n*Bio:* ${data.bio || "N/A"}`;
        await ctx.replyWithPhoto(data.avatar_url, { caption, parse_mode: "Markdown" });
    } catch (error) {
        ctx.reply("❌ Username tidak ditemukan.");
    }
});

bot.command("spotify", async (ctx) => {
    const query = ctx.message.text.split(" ").slice(1).join(" ");
    if (!query) return ctx.reply("❓ Penggunaan: `/spotify <judul lagu>`");
    try {
        const { data } = await hitoriApi.get("/search/spotify", { params: { query } });
        const result = data.data[0];
        const caption = `*🎶 Ditemukan di Spotify*\n\n*Judul:* ${result.title}\n*Artis:* ${result.artist}\n\n[Dengarkan di Spotify](${result.url})`;
        await ctx.replyWithPhoto(result.thumbnail, { caption, parse_mode: "Markdown" });
    } catch (error) {
        ctx.reply("❌ Gagal mencari lagu di Spotify.");
    }
});

bot.command("urban", async (ctx) => {
    const query = ctx.message.text.split(" ").slice(1).join(" ");
    if (!query) return ctx.reply("❓ Penggunaan: `/urban <kata gaul>`");
    try {
        const { data } = await axios.get(`https://api.urbandictionary.com/v0/define?term=${query}`);
        if (!data.list.length) return ctx.reply("❌ Definisi tidak ditemukan.");
        const result = data.list[0];
        const message = `*Kata:* ${result.word}\n\n*Definisi:*\n${result.definition.replace(/[\[\]]/g, "")}\n\n*Contoh:*\n_${result.example.replace(/[\[\]]/g, "")}_`;
        await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
        ctx.reply("❌ Gagal mencari definisi.");
    }
});


bot.command("tenor", async (ctx) => {
    const query = ctx.message.text.split(" ").slice(1).join(" ");
    if (!query) return ctx.reply("❓ Penggunaan: `/tenor <kata kunci gif>`");
    try {
        const { data } = await hitoriApi.get("/search/tenor", { params: { query } });
        const randomGif = data.data[Math.floor(Math.random() * data.data.length)];
        await ctx.replyWithAnimation(randomGif.url);
    } catch (error) {
        ctx.reply("❌ Gagal mencari GIF.");
    }
});

bot.command("npm", async (ctx) => {
    const query = ctx.message.text.split(" ").slice(1).join(" ");
    if (!query) return ctx.reply("❓ Penggunaan: `/npm <nama paket>`");
    try {
        const { data } = await axios.get(`https://registry.npmjs.org/-/v1/search?text=${query}&size=5`);
        if (!data.objects.length) return ctx.reply("❌ Paket tidak ditemukan.");
        const message = data.objects.map(({ package: pkg }) => `*${pkg.name}* (v${pkg.version})\n_${pkg.description}_\n[Lihat di NPM](${pkg.links.npm})`).join("\n\n");
        await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
        ctx.reply("❌ Gagal mencari paket.");
    }
});

bot.command("ssweb", async (ctx) => {
    const url = ctx.message.text.split(" ")[1];
    if (!url || !url.startsWith("http")) return ctx.reply("❓ Penggunaan: `/ssweb <https://website.com>`");
    const waitingMessage = await ctx.reply("📸 Mengambil screenshot...");
    try {
        const response = await axios.get(`https://image.thum.io/get/width/1920/crop/1080/fullpage/${url}`, { responseType: "arraybuffer" });
        await ctx.replyWithDocument({ source: response.data, filename: "screenshot.png" });
        ctx.deleteMessage(waitingMessage.message_id).catch(() => {});
    } catch (error) {
        ctx.telegram.editMessageText(ctx.chat.id, waitingMessage.message_id, null, "❌ Gagal mengambil screenshot.").catch(() => {});
    }
});

bot.command("cuaca", async (ctx) => {
    const city = ctx.message.text.split(" ").slice(1).join(" ");
    if (!city) return ctx.reply("❓ Contoh penggunaan: `/cuaca Jakarta`");
    try {
        await ctx.replyWithChatAction("typing");
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}&lang=id`;
        const response = await axios.get(apiUrl);
        const data = response.data;
        const weatherInfo = `*🏙 Cuaca di Kota ${data.name}*\n\n*Cuaca:* ${data.weather[0].description}\n*Suhu:* ${data.main.temp}°C (terasa seperti ${data.main.feels_like}°C)\n*Kelembapan:* ${data.main.humidity}%\n*Angin:* ${data.wind.speed} m/s`;
        await ctx.reply(weatherInfo, { parse_mode: "Markdown" });
    } catch (error) {
        ctx.reply("❌ Gagal mengambil data cuaca. Cek kembali nama kota.");
    }
});


// --- ✍️ IMPLEMENTASI FITUR TEKS & KONTEN ✍️ --- //
const sendRandomQuote = async (ctx, endpoint) => {
    try {
        const { data } = await hitoriApi.get(`/random/${endpoint}`);
        ctx.reply(data.data.result);
    } catch {
        ctx.reply("❌ Gagal mengambil data.");
    }
};
bot.command("quotes", (ctx) => sendRandomQuote(ctx, "quotes"));
bot.command("motivasi", (ctx) => sendRandomQuote(ctx, "motivasi"));
bot.command("bucin", (ctx) => sendRandomQuote(ctx, "bucin"));

bot.command("style", async (ctx) => {
    const text = ctx.message.text.split(" ").slice(1).join(" ");
    if (!text) return ctx.reply("❓ Penggunaan: `/style <teks kamu>`");
    try {
        const { data } = await hitoriApi.get("/tools/styletext", { params: { text } });
        const message = data.data.map(style => `*${style.name}:* \`${style.result}\``).join("\n\n");
        ctx.reply(message, { parse_mode: "Markdown" });
    } catch {
        ctx.reply("❌ Gagal membuat style text.");
    }
});

bot.command("kopi", (ctx) => ctx.replyWithPhoto("https://coffee.alexflipnote.dev/random", { caption: "☕ Ngopi dulu, bray!" }));
bot.command("meme", async (ctx) => {
    try {
        const { data } = await axios.get("https://meme-api.com/gimme");
        await ctx.replyWithPhoto(data.url, { caption: `*${data.title}*`, parse_mode: "Markdown" });
    } catch {
        ctx.reply("❌ Gagal mengambil meme.");
    }
});


// --- 🚀 PELUNCURAN BOT & ERROR HANDLING 🚀 --- //
bot.catch((err, ctx) => {
    console.error(`Error untuk ${ctx.updateType}:`, err);
    ctx.reply("❌ Terjadi kesalahan internal. Coba lagi nanti.").catch(e => console.error("Gagal mengirim pesan error:", e));
});

(async () => {
    await initDatabase();
    bot.launch();
    console.log("🚀 Bot Legendaris v19.0.0 (FINAL BANGET) telah aktif!");
    // Graceful shutdown
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
})();


