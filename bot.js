const { Telegraf } = require("telegraf");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs").promises;
const path = require("path");

// --- ⚙️ KONFIGURASI UTAMA ⚙️ --- //
const BOT_TOKEN = process.env.BOT_TOKEN || '8021784210:AAFf6UO4T9lHP66VySh5GDTh0qdv5mjZQG0';
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'b1fef27991b8b70b537697eefa81044a';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAuKMjIfDVFm4Y5LN8YNoE8G4f4eBVZHHM';

// --- 🗂️ Database & Lokasi File 🗂️ --- //
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PINS_FILE = path.join(DATA_DIR, "pins.json");
const CONVERSATIONS_DIR = path.join(DATA_DIR, "conversations"); // Folder untuk menyimpan chat history

// --- 🧠 Class Database (dengan fungsi AI history) 🧠 --- //
class Database {
    static async loadData(filePath) {
        try {
            const data = await fs.readFile(filePath, "utf8");
            return JSON.parse(data);
        } catch (error) {
            if (error.code === "ENOENT") return {};
            throw error;
        }
    }

    static async saveData(filePath, data) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
    }

    static async init() {
        await fs.mkdir(CONVERSATIONS_DIR, { recursive: true }); // Pastikan folder conversation ada
        if (!(await fs.access(USERS_FILE).then(() => true).catch(() => false))) await this.saveData(USERS_FILE, {});
        if (!(await fs.access(PINS_FILE).then(() => true).catch(() => false))) await this.saveData(PINS_FILE, {});
    }

    static async addOrUpdateUser(userId, username, firstName) {
        const users = await this.loadData(USERS_FILE);
        users[userId] = { username: username || null, firstName: firstName || 'User', lastActivity: new Date().toISOString() };
        await this.saveData(USERS_FILE, users);
    }

    static async addPin(userId, imageUrl, animeName) {
        const pins = await this.loadData(PINS_FILE);
        if (!pins[userId]) pins[userId] = [];
        const newPin = { id: Date.now().toString(), imageUrl, animeName, timestamp: new Date().toISOString() };
        pins[userId].push(newPin);
        await this.saveData(PINS_FILE, pins);
        return newPin.id;
    }
    
    // Fungsi untuk memuat history chat AI
    static async loadConversation(userId) {
        const filePath = path.join(CONVERSATIONS_DIR, `${userId}.json`);
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return []; // Jika file tidak ada, mulai dengan history kosong
        }
    }

    // Fungsi untuk menyimpan history chat AI
    static async saveConversation(userId, history) {
        const filePath = path.join(CONVERSATIONS_DIR, `${userId}.json`);
        await this.saveData(filePath, history);
    }
}

// --- 🤖 Inisialisasi Bot & AI 🤖 --- //
const bot = new Telegraf(BOT_TOKEN);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- 🎨 Helper & Data 🎨 --- //
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sfwCategories = ['waifu', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'slap', 'kill', 'kick', 'happy', 'wink', 'poke', 'dance', 'cringe'];
const nsfwCategories = ["waifu", "neko", "trap", "blowjob"];

// --- 🌟 PERINTAH UTAMA 🌟 --- //

// /start
bot.start(async (ctx) => {
    const { id, username, first_name } = ctx.from;
    await Database.addOrUpdateUser(id.toString(), username, first_name);
    const welcomeMessage = `
🌸 *Selamat Datang, ${first_name}!* 🌸

Saya adalah Bot Anime yang siap membantu Anda.
Ketik /help untuk melihat semua perintah yang tersedia.

Selamat menikmati! ✨
    `;
    await ctx.replyWithPhoto('https://i.waifu.pics/dPXxQqE.png', {
        caption: welcomeMessage,
        parse_mode: 'Markdown'
    });
});

// /help
bot.help((ctx) => {
    const helpMessage = `
*🤖 Bantuan Bot Anime 🤖*

Berikut adalah daftar perintah yang bisa Anda gunakan:

*Gambar & Anime:*
• \`/random\` - Mengirim gambar anime acak.
• \`/nsfw\` - Gambar anime 18+ (hanya di private chat).
• \`/search <nama>\` - Mencari info detail sebuah anime.
• \`/pin <link_gambar>\` - Menyimpan gambar ke koleksi Anda.
• \`/pins\` - Menampilkan koleksi gambar yang Anda simpan.

*AI & Hiburan:*
• \`/ai <pesan>\` - Ngobrol dengan AI Gemini (punya memori!).
• \`/reset\` - Menghapus memori percakapan dengan AI.
• \`/meme\` - Mengirim meme acak dari internet.
• \`/quotes\` - Kutipan inspiratif.
• \`/jokes\` - Lelucon receh.

*Info & Utilitas:*
• \`/berita\` - Berita terbaru seputar teknologi.
• \`/cuaca <kota>\` - Informasi cuaca terkini.
• \`/help\` - Menampilkan pesan bantuan ini.
    `;
    ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

// /ai (SEKARANG DENGAN MEMORI)
bot.command("ai", async (ctx) => {
    const userId = ctx.from.id.toString();
    const userMessage = ctx.message.text.split(' ').slice(1).join(' ');
    if (!userMessage) return ctx.reply("❓ Penggunaan: `/ai <pertanyaan Anda>`");

    try {
        await ctx.replyWithChatAction("typing");

        // 1. Muat history percakapan yang ada
        const history = await Database.loadConversation(userId);

        // 2. Mulai sesi chat dengan history sebelumnya
        const chat = aiModel.startChat({ history });

        // 3. Kirim pesan baru dan dapatkan hasilnya
        const result = await chat.sendMessage(userMessage);
        const response = await result.response;
        const text = response.text();

        // 4. Dapatkan history terbaru dari Gemini dan simpan
        const updatedHistory = await chat.getHistory();
        await Database.saveConversation(userId, updatedHistory);

        await ctx.reply(`*🤖 Jawaban dari Gemini:*\n\n${text}`, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error("Error with Gemini AI:", error);
        ctx.reply("❌ Maaf, terjadi kesalahan saat berkomunikasi dengan AI.");
    }
});

// /reset (PERINTAH BARU)
bot.command("reset", async (ctx) => {
    const userId = ctx.from.id.toString();
    // Hapus file history percakapan
    await Database.saveConversation(userId, []);
    await ctx.reply("🔄 Memori percakapan AI telah berhasil dihapus. Kita mulai dari awal lagi!");
});


// --- Sisa kode lainnya tetap sama --- //

// /random
bot.command("random", async (ctx) => {
    try {
        await ctx.replyWithChatAction("upload_photo");
        const category = getRandomItem(sfwCategories);
        const res = await axios.get(`https://api.waifu.pics/sfw/${category}`);
        const caption = `🎨 *Kategori: ${category}*\n\n💡 Tips: Anda bisa menyimpan gambar ini dengan perintah \`/pin ${res.data.url}\``;
        await ctx.replyWithPhoto(res.data.url, { caption, parse_mode: 'Markdown' });
    } catch (error) {
        ctx.reply("❌ Gagal mengambil gambar random. Coba lagi nanti.");
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
        const caption = `🔞 *Kategori NSFW: ${category}*`;
        await ctx.replyWithPhoto(res.data.url, { caption, parse_mode: 'Markdown' });
    } catch (error) {
        ctx.reply("❌ Gagal mengambil gambar NSFW.");
    }
});

// /search
bot.command("search", async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ');
    if (!query) return ctx.reply("❓ Penggunaan: `/search <nama anime>`\nContoh: `/search Attack on Titan`");

    try {
        await ctx.replyWithChatAction("typing");
        const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`);
        if (!res.data.data || res.data.data.length === 0) {
            return ctx.reply(`❌ Anime "*${query}*" tidak ditemukan.`);
        }
        const anime = res.data.data[0];
        const imageUrl = anime.images?.jpg?.large_image_url;
        const synopsis = anime.synopsis ? anime.synopsis.substring(0, 400) + '...' : 'Tidak tersedia.';
        const caption = `
*📺 ${anime.title}* (${anime.year || 'N/A'})

⭐ *Rating:* ${anime.score || 'N/A'}
📊 *Status:* ${anime.status || 'N/A'}
🎬 *Episode:* ${anime.episodes || 'N/A'}

*📖 Sinopsis:*
${synopsis}

💡 Tips: Anda bisa menyimpan poster ini dengan perintah \`/pin ${imageUrl}\`
        `;
        if (imageUrl) {
            await ctx.replyWithPhoto(imageUrl, { caption, parse_mode: 'Markdown' });
        } else {
            await ctx.reply(caption, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        ctx.reply("❌ Terjadi kesalahan saat mencari anime.");
    }
});

// /berita
bot.command("berita", async (ctx) => {
    try {
        await ctx.replyWithChatAction("typing");
        const res = await axios.get("https://api.spaceflightnewsapi.net/v4/articles/?limit=5");
        const articles = res.data.results;
        if (!articles || articles.length === 0) return ctx.reply("⚠️ Tidak ada berita yang bisa ditampilkan.");

        let beritaMessage = "*📰 Berita Teknologi & Luar Angkasa Terbaru:*\n\n";
        articles.forEach(article => {
            beritaMessage += `*${article.title}*\n`;
            beritaMessage += `*Sumber:* ${article.news_site}\n`;
            beritaMessage += `[Baca selengkapnya](${article.url})\n\n`;
        });
        await ctx.reply(beritaMessage, { parse_mode: "Markdown", disable_web_page_preview: true });
    } catch (error) {
        ctx.reply("⚠️ Gagal mengambil berita. Coba lagi nanti.");
    }
});

// /pin
bot.command("pin", async (ctx) => {
    const args = ctx.message.text.split(' ');
    const imageUrl = args[1];
    if (!imageUrl || !imageUrl.startsWith('http')) {
        return ctx.reply("❓ Penggunaan: `/pin <link_gambar_valid>`");
    }
    try {
        const userId = ctx.from.id.toString();
        const animeName = args.slice(2).join(' ') || 'Gambar';
        await Database.addPin(userId, imageUrl, animeName);
        await ctx.reply("📌 Gambar berhasil disimpan ke koleksi Anda!");
    } catch (error) {
        await ctx.reply("❌ Gagal menyimpan pin. Pastikan link valid.");
    }
});

// /pins
bot.command("pins", async (ctx) => {
    try {
        const userId = ctx.from.id.toString();
        const userPins = await Database.getUserPins(userId);
        if (!userPins || userPins.length === 0) {
            return ctx.reply("📭 Koleksi pin Anda masih kosong.\nGunakan `/pin <link_gambar>` untuk menyimpan.");
        }
        await ctx.reply(`*📌 Koleksi Pin Anda (${userPins.length} gambar):*`, { parse_mode: 'Markdown' });
        for (const pin of userPins.slice(-5).reverse()) {
            await ctx.replyWithPhoto(pin.imageUrl, {
                caption: `*${pin.animeName}*\nDisimpan pada: ${new Date(pin.timestamp).toLocaleDateString('id-ID')}`,
                parse_mode: 'Markdown'
            });
        }
    } catch (error) {
        ctx.reply("❌ Gagal mengambil koleksi pin.");
    }
});

// Perintah Hiburan
bot.command("meme", async (ctx) => {
    try {
        const res = await axios.get("https://meme-api.com/gimme");
        ctx.replyWithPhoto(res.data.url, { caption: `*${res.data.title}*` , parse_mode: 'Markdown'});
    } catch { ctx.reply("⚠️ Gagal ambil meme."); }
});
bot.command("jokes", (ctx) => ctx.reply(getRandomItem(["Kenapa programmer jomblo? Karena salah fokus, harusnya deketin orang, malah deketin bug.", "Apa bedanya modem sama korupsi? Sama-sama makan pulsa rakyat."])));
bot.command("quotes", (ctx) => ctx.reply(getRandomItem(["Kunci kesuksesan adalah... duplikatnya.", "Jangan berhenti saat lelah, berhenti saat selesai."])));

// Utilitas
bot.command("cuaca", async (ctx) => {
    const city = ctx.message.text.split(' ').slice(1).join(' ');
    if (!city) return ctx.reply("❓ Contoh: `/cuaca Jakarta`");
    try {
        const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=metric&lang=id`);
        const { name, main, weather } = res.data;
        ctx.reply(`*🌤️ Cuaca di ${name}:*\n\n🌡️ Suhu: ${main.temp}°C\n${weather[0].description}`, { parse_mode: "Markdown" });
    } catch {
        ctx.reply("⚠️ Gagal mengambil data cuaca. Pastikan nama kota benar.");
    }
});

// Peluncuran Bot
bot.catch((err, ctx) => {
  console.error(`Error untuk ${ctx.updateType}`, err);
  ctx.reply("❌ Terjadi kesalahan internal. Mohon coba lagi nanti.").catch(e => console.error("Gagal mengirim pesan error:", e));
});

(async () => {
  await Database.init();
  bot.launch();
  console.log("🚀 Bot Anime v3 (dengan memori) telah aktif!");
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
})();