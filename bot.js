const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, AttachmentBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

// Bot configuration
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers
    ]
});

// Data storage paths
const DATA_DIR = './data';
const ACCOUNTS_DIR = path.join(DATA_DIR, 'accounts');
const USER_ACCESS_FILE = path.join(DATA_DIR, 'user_access.json');
const COOLDOWNS_FILE = path.join(DATA_DIR, 'cooldowns.json');
const USER_COOLDOWNS_FILE = path.join(DATA_DIR, 'user_cooldowns.json');

// Initialize data directories and files
async function initializeData() {
    await fs.ensureDir(DATA_DIR);
    await fs.ensureDir(ACCOUNTS_DIR);
    
    // Create subdirectories for each category
    const categories = ['free', 'premium', 'booster', 'vip'];
    
    for (const category of categories) {
        await fs.ensureDir(path.join(ACCOUNTS_DIR, category));
    }
    
    // Initialize JSON files if they don't exist
    if (!await fs.pathExists(USER_ACCESS_FILE)) {
        await fs.writeJson(USER_ACCESS_FILE, {});
    }
    if (!await fs.pathExists(COOLDOWNS_FILE)) {
        await fs.writeJson(COOLDOWNS_FILE, {
            free: 0,
            premium: 0,
            booster: 0,
            vip: 0
        });
    }
    if (!await fs.pathExists(USER_COOLDOWNS_FILE)) {
        await fs.writeJson(USER_COOLDOWNS_FILE, {});
    }
}

// Helper functions
async function loadUserAccess() {
    return await fs.readJson(USER_ACCESS_FILE);
}

async function saveUserAccess(data) {
    await fs.writeJson(USER_ACCESS_FILE, data);
}

async function loadCooldowns() {
    return await fs.readJson(COOLDOWNS_FILE);
}

async function saveCooldowns(data) {
    await fs.writeJson(COOLDOWNS_FILE, data);
}

async function loadUserCooldowns() {
    return await fs.readJson(USER_COOLDOWNS_FILE);
}

async function saveUserCooldowns(data) {
    await fs.writeJson(USER_COOLDOWNS_FILE, data);
}

async function getAccountCount(category, service = null) {
    let totalAccounts = 0;
    
    if (service) {
        // Count for specific service
        const servicePath = path.join(ACCOUNTS_DIR, category, service);
        if (await fs.pathExists(servicePath)) {
            const files = await fs.readdir(servicePath);
            const txtFiles = files.filter(file => file.endsWith('.txt'));
            
            for (const file of txtFiles) {
                const filePath = path.join(servicePath, file);
                const content = await fs.readFile(filePath, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                totalAccounts += lines.length;
            }
        }
    } else {
        // Count for all services in category
        const categoryPath = path.join(ACCOUNTS_DIR, category);
        
        if (await fs.pathExists(categoryPath)) {
            const services = await fs.readdir(categoryPath);
            
            for (const service of services) {
                const servicePath = path.join(categoryPath, service);
                const stat = await fs.stat(servicePath);
                
                if (stat.isDirectory()) {
                    const files = await fs.readdir(servicePath);
                    const txtFiles = files.filter(file => file.endsWith('.txt'));
                    
                    for (const file of txtFiles) {
                        const filePath = path.join(servicePath, file);
                        const content = await fs.readFile(filePath, 'utf8');
                        const lines = content.split('\n').filter(line => line.trim());
                        totalAccounts += lines.length;
                    }
                }
            }
        }
    }
    
    return totalAccounts;
}

async function getRandomAccount(category, service) {
    const servicePath = path.join(ACCOUNTS_DIR, category, service);
    
    if (!await fs.pathExists(servicePath)) return null;
    
    const files = await fs.readdir(servicePath);
    const txtFiles = files.filter(file => file.endsWith('.txt'));
    
    if (txtFiles.length === 0) return null;
    
    const randomFile = txtFiles[Math.floor(Math.random() * txtFiles.length)];
    const filePath = path.join(servicePath, randomFile);
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
        await fs.remove(filePath);
        return null;
    }
    
    const randomIndex = Math.floor(Math.random() * lines.length);
    const randomAccount = lines[randomIndex];
    
    // Remove the used account from file (only one occurrence)
    const remainingLines = [...lines];
    remainingLines.splice(randomIndex, 1);
    if (remainingLines.length === 0) {
        await fs.remove(filePath);
    } else {
        await fs.writeFile(filePath, remainingLines.join('\n'));
    }
    
    return randomAccount;
}

function hasAccess(userId, category, userAccess) {
    if (!userAccess[userId]) return false;
    
    const user = userAccess[userId];
    
    // Handle old array format for backward compatibility
    if (Array.isArray(user)) {
        return user.includes(category);
    }
    
    // Handle new object format with expiry
    if (user[category]) {
        if (typeof user[category] === 'object' && user[category].expiry) {
            return user[category].expiry > Date.now();
        }
        return true; // Permanent access
    }
    
    return false;
}

function convertTimeToMilliseconds(time, unit) {
    const conversions = {
        'seconds': 1000,
        'minutes': 60 * 1000,
        'hours': 60 * 60 * 1000,
        'days': 24 * 60 * 60 * 1000,
        'weeks': 7 * 24 * 60 * 60 * 1000
    };
    return time * (conversions[unit] || 1000);
}

function cleanExpiredAccess(userAccess) {
    const now = Date.now();
    const cleanedAccess = {};
    
    for (const userId in userAccess) {
        const user = userAccess[userId];
        cleanedAccess[userId] = {};
        
        // Handle legacy array format
        if (Array.isArray(user)) {
            // Convert legacy array to new object format
            for (const category of user) {
                cleanedAccess[userId][category] = { permanent: true };
            }
        } else {
            // Handle new object format
            for (const category in user) {
                if (typeof user[category] === 'object' && user[category].expiry) {
                    // Check if not expired
                    if (user[category].expiry > now) {
                        cleanedAccess[userId][category] = user[category];
                    }
                } else {
                    // Permanent access or old format
                    cleanedAccess[userId][category] = user[category];
                }
            }
        }
        
        // Clean empty user objects
        if (Object.keys(cleanedAccess[userId]).length === 0) {
            delete cleanedAccess[userId];
        }
    }
    
    return cleanedAccess;
}

function isOnCooldown(userId, category, userCooldowns, cooldowns) {
    const now = Date.now();
    const userCooldownData = userCooldowns[userId] || {};
    const lastUsed = userCooldownData[category] || 0;
    const cooldownTime = cooldowns[category] || 0; // Already in milliseconds
    
    return (now - lastUsed) < cooldownTime;
}

function getRemainingCooldown(userId, category, userCooldowns, cooldowns) {
    const now = Date.now();
    const userCooldownData = userCooldowns[userId] || {};
    const lastUsed = userCooldownData[category] || 0;
    const cooldownTime = cooldowns[category] || 0;
    
    return Math.max(0, cooldownTime - (now - lastUsed));
}

// Slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('stock')
        .setDescription('Available accounts ka stock check karo'),
    
    new SlashCommandBuilder()
        .setName('restock')
        .setDescription('Accounts restock karo')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Account category select karo')
                .setRequired(true)
                .addChoices(
                    { name: 'Free', value: 'free' },
                    { name: 'Premium', value: 'premium' },
                    { name: 'Booster', value: 'booster' },
                    { name: 'VIP', value: 'vip' }
                ))
        .addStringOption(option =>
            option.setName('service')
                .setDescription('Service naam likho (jaise: netflix, spotify, etc)')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('file')
                .setDescription('Account file upload karo')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('free')
        .setDescription('Free account generate ')
        .addStringOption(option =>
            option.setName('service')
                .setDescription('Service naam likho (jaise: netflix, spotify, etc)')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('premium')
        .setDescription('Premium account generate ')
        .addStringOption(option =>
            option.setName('service')
                .setDescription('Service naam likho (jaise: netflix, spotify, etc)')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('booster')
        .setDescription('Booster account generate ')
        .addStringOption(option =>
            option.setName('service')
                .setDescription('Service naam likho (jaise: netflix, spotify, etc)')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('vip')
        .setDescription('VIP account generate ')
        .addStringOption(option =>
            option.setName('service')
                .setDescription('Service naam likho (jaise: netflix, spotify, etc)')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('addaccess')
        .setDescription('User ko access dedo')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Jis user ko access dena hai')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Access category')
                .setRequired(true)
                .addChoices(
                    { name: 'Free', value: 'free' },
                    { name: 'Premium', value: 'premium' },
                    { name: 'Booster', value: 'booster' },
                    { name: 'VIP', value: 'vip' }
                ))
        .addIntegerOption(option =>
            option.setName('time')
                .setDescription('Access duration (0 for permanent)')
                .setRequired(false)
                .setMinValue(0))
        .addStringOption(option =>
            option.setName('unit')
                .setDescription('Time unit (only if time is specified)')
                .setRequired(false)
                .addChoices(
                    { name: 'Minutes', value: 'minutes' },
                    { name: 'Hours', value: 'hours' },
                    { name: 'Days', value: 'days' },
                    { name: 'Weeks', value: 'weeks' }
                )),
    
    new SlashCommandBuilder()
        .setName('cooldown')
        .setDescription('Cooldown set karo')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Category select karo')
                .setRequired(true)
                .addChoices(
                    { name: 'Free', value: 'free' },
                    { name: 'Premium', value: 'premium' },
                    { name: 'Booster', value: 'booster' },
                    { name: 'VIP', value: 'vip' }
                ))
        .addIntegerOption(option =>
            option.setName('time')
                .setDescription('Cooldown time value')
                .setRequired(true)
                .setMinValue(0))
        .addStringOption(option =>
            option.setName('unit')
                .setDescription('Time unit')
                .setRequired(true)
                .addChoices(
                    { name: 'Seconds', value: 'seconds' },
                    { name: 'Minutes', value: 'minutes' },
                    { name: 'Hours', value: 'hours' },
                    { name: 'Days', value: 'days' }
                )),
    
    new SlashCommandBuilder()
        .setName('clearstock')
        .setDescription('Category ki saari inventory clear karo')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Kis category ka stock clear karna hai')
                .setRequired(true)
                .addChoices(
                    { name: 'Free', value: 'free' },
                    { name: 'Premium', value: 'premium' },
                    { name: 'Booster', value: 'booster' }
                ))
        .addStringOption(option =>
            option.setName('service')
                .setDescription('Service naam likho (optional - chhodo to saari services clear ho jayengi)')
                .setRequired(false))
];

client.once('ready', async () => {
    console.log(`Bot ready! Logged in as ${client.user.tag}`);
    
    // Initialize data
    await initializeData();
    
    // Register slash commands
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
        console.log('Slash commands register kar rahe hain...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Slash commands successfully register ho gaye!');
    } catch (error) {
        console.error('Slash commands register karne mein error:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;
    
    try {
        if (commandName === 'stock') {
            const freeCount = await getAccountCount('free');
            const premiumCount = await getAccountCount('premium');
            const boosterCount = await getAccountCount('booster');
            const vipCount = await getAccountCount('vip');
            
            const embed = new EmbedBuilder()
                .setTitle('📦 Account Stock')
                .setColor('#00ff00')
                .addFields(
                    { name: '🆓 Free', value: `${freeCount} accounts`, inline: true },
                    { name: '💎 Premium', value: `${premiumCount} accounts`, inline: true },
                    { name: '🚀 Booster', value: `${boosterCount} accounts`, inline: true },
                    { name: '👑 VIP', value: `${vipCount} accounts`, inline: true }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
            
        } else if (commandName === 'restock') {
            // Only allow server administrators
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return await interaction.reply({ 
                    content: '❌ Sirf administrators ye command use kar sakte hain!', 
                    ephemeral: true 
                });
            }
            
            const category = interaction.options.getString('category');
            const service = interaction.options.getString('service');
            const attachment = interaction.options.getAttachment('file');
            
            if (!attachment.name.endsWith('.txt')) {
                return await interaction.reply({ content: '❌ Sirf .txt files upload kar sakte hain!', ephemeral: true });
            }
            
            // Check file size (max 10MB)
            if (attachment.size > 10 * 1024 * 1024) {
                return await interaction.reply({ content: '❌ File size 10MB se kam honi chahiye!', ephemeral: true });
            }
            
            try {
                const response = await fetch(attachment.url);
                let content = await response.text();
                
                // Normalize line endings and filter empty lines
                content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                const validLines = content.split('\n').filter(line => line.trim());
                
                const timestamp = Date.now();
                const fileName = `accounts_${timestamp}.txt`;
                const filePath = path.join(ACCOUNTS_DIR, category, service, fileName);
                
                await fs.writeFile(filePath, validLines.join('\n'));
                
                const lines = validLines.length;
                
                const embed = new EmbedBuilder()
                    .setTitle('✅ Restock Successful')
                    .setColor('#00ff00')
                    .addFields(
                        { name: 'Category', value: category.toUpperCase(), inline: true },
                        { name: 'Service', value: service.toUpperCase(), inline: true },
                        { name: 'Accounts Added', value: `${lines}`, inline: true }
                    )
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
                
            } catch (error) {
                console.error('File download error:', error);
                await interaction.reply({ content: '❌ File download karne mein error aaya!', ephemeral: true });
            }
            
        } else if (['free', 'premium', 'booster', 'vip'].includes(commandName)) {
            const category = commandName;
            const service = interaction.options.getString('service');
            const userId = interaction.user.id;
            
            const userAccess = await loadUserAccess();
            const cooldowns = await loadCooldowns();
            const userCooldowns = await loadUserCooldowns();
            
            // Check custom status for free command and auto-grant access
            if (category === 'free') {
                const member = await interaction.guild.members.fetch(userId);
                const customStatus = member.presence?.activities?.find(activity => activity.type === 4);
                
                if (!customStatus || !customStatus.state?.includes('discord.gg/r6cY75E5rK')) {
                    return await interaction.reply({ 
                        content: '❌ Free command use karne ke liye apne Discord status mein "discord.gg/r6cY75E5rK" lagao!', 
                        ephemeral: true 
                    });
                }
                
                // Auto-grant free access if they have the status
                if (!userAccess[userId]) {
                    userAccess[userId] = {};
                }
                if (!userAccess[userId]['free']) {
                    userAccess[userId]['free'] = { permanent: true };
                    await saveUserAccess(userAccess);
                }
            }
            
            // Check access
            if (!hasAccess(userId, category, userAccess)) {
                return await interaction.reply({ 
                    content: `❌ Aapke paas ${category.toUpperCase()} access nahi hai!`, 
                    ephemeral: true 
                });
            }
            
            // Check cooldown
            if (isOnCooldown(userId, category, userCooldowns, cooldowns)) {
                const remaining = getRemainingCooldown(userId, category, userCooldowns, cooldowns);
                const remainingSeconds = Math.ceil(remaining / 1000);
                return await interaction.reply({ 
                    content: `⏰ Cooldown active hai! ${remainingSeconds} seconds wait karo.`, 
                    ephemeral: true 
                });
            }
            
            // Get account
            const account = await getRandomAccount(category, service);
            
            if (!account) {
                return await interaction.reply({ 
                    content: `❌ ${category.toUpperCase()} ${service.toUpperCase()} accounts stock mein nahi hain!`, 
                    ephemeral: true 
                });
            }
            
            // Update cooldown
            if (!userCooldowns[userId]) userCooldowns[userId] = {};
            userCooldowns[userId][category] = Date.now();
            await saveUserCooldowns(userCooldowns);
            
            // Send account in DM
            try {
                const embed = new EmbedBuilder()
                    .setTitle(`🎉 ${category.toUpperCase()} ${service.toUpperCase()} Account`)
                    .setDescription(`\`\`\`${account}\`\`\``)
                    .setColor('#00ff00')
                    .setTimestamp();
                
                await interaction.user.send({ embeds: [embed] });
                await interaction.reply({ 
                    content: '✅ Account aapke DM mein bhej diya gaya hai!', 
                    ephemeral: true 
                });
                
            } catch (error) {
                await interaction.reply({ 
                    content: `✅ Yahan hai aapka ${category.toUpperCase()} ${service.toUpperCase()} account:\n\`\`\`${account}\`\`\``, 
                    ephemeral: true 
                });
            }
            
        } else if (commandName === 'addaccess') {
            // Only allow server administrators
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return await interaction.reply({ 
                    content: '❌ Sirf administrators ye command use kar sakte hain!', 
                    ephemeral: true 
                });
            }
            
            const user = interaction.options.getUser('user');
            const category = interaction.options.getString('category');
            const time = interaction.options.getInteger('time');
            const unit = interaction.options.getString('unit');
            
            let userAccess = await loadUserAccess();
            
            // Clean expired access first
            userAccess = cleanExpiredAccess(userAccess);
            
            if (!userAccess[user.id]) {
                userAccess[user.id] = {};
            }
            
            let accessData;
            let responseMessage;
            
            if (!time || time === 0) {
                // Permanent access
                accessData = { permanent: true };
                responseMessage = `✅ ${user.username} ko permanent ${category.toUpperCase()} access de diya gaya!`;
            } else {
                // Temporary access
                if (!unit) {
                    return await interaction.reply({ 
                        content: '❌ Time specify karne ke saath unit bhi select karna padega!', 
                        ephemeral: true 
                    });
                }
                
                const duration = convertTimeToMilliseconds(time, unit);
                const expiry = Date.now() + duration;
                accessData = { expiry: expiry };
                responseMessage = `✅ ${user.username} ko ${time} ${unit} ke liye ${category.toUpperCase()} access de diya gaya!`;
            }
            
            userAccess[user.id][category] = accessData;
            await saveUserAccess(userAccess);
            
            await interaction.reply({ content: responseMessage });
            
        } else if (commandName === 'cooldown') {
            // Only allow server administrators
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return await interaction.reply({ 
                    content: '❌ Sirf administrators ye command use kar sakte hain!', 
                    ephemeral: true 
                });
            }
            
            const category = interaction.options.getString('category');
            const time = interaction.options.getInteger('time');
            const unit = interaction.options.getString('unit');
            
            const cooldowns = await loadCooldowns();
            const milliseconds = convertTimeToMilliseconds(time, unit);
            cooldowns[category] = milliseconds;
            await saveCooldowns(cooldowns);
            
            await interaction.reply({ 
                content: `✅ ${category.toUpperCase()} ka cooldown ${time} ${unit} set kar diya gaya!` 
            });
            
        } else if (commandName === 'clearstock') {
            // Only allow server administrators
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return await interaction.reply({ 
                    content: '❌ Sirf administrators ye command use kar sakte hain!', 
                    ephemeral: true 
                });
            }
            
            const category = interaction.options.getString('category');
            const service = interaction.options.getString('service');
            
            let deletedCount = 0;
            
            if (service) {
                // Clear specific service
                const servicePath = path.join(ACCOUNTS_DIR, category, service);
                if (await fs.pathExists(servicePath)) {
                    const files = await fs.readdir(servicePath);
                    const txtFiles = files.filter(file => file.endsWith('.txt'));
                    
                    for (const file of txtFiles) {
                        await fs.remove(path.join(servicePath, file));
                        deletedCount++;
                    }
                }
                
                const embed = new EmbedBuilder()
                    .setTitle('🗑️ Stock Cleared')
                    .setColor('#ff0000')
                    .addFields(
                        { name: 'Category', value: category.toUpperCase(), inline: true },
                        { name: 'Service', value: service.toUpperCase(), inline: true },
                        { name: 'Files Deleted', value: `${deletedCount}`, inline: true }
                    )
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
                
            } else {
                // Clear all services in category
                const services = ['minecraft', 'netflix', 'spotify', 'xbox', 'disney', 'prime', 'hulu', 'other'];
                
                for (const svc of services) {
                    const servicePath = path.join(ACCOUNTS_DIR, category, svc);
                    if (await fs.pathExists(servicePath)) {
                        const files = await fs.readdir(servicePath);
                        const txtFiles = files.filter(file => file.endsWith('.txt'));
                        
                        for (const file of txtFiles) {
                            await fs.remove(path.join(servicePath, file));
                            deletedCount++;
                        }
                    }
                }
                
                const embed = new EmbedBuilder()
                    .setTitle('🗑️ Stock Cleared')
                    .setColor('#ff0000')
                    .addFields(
                        { name: 'Category', value: category.toUpperCase(), inline: true },
                        { name: 'Services', value: 'ALL', inline: true },
                        { name: 'Files Deleted', value: `${deletedCount}`, inline: true }
                    )
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
            }
        }
        
    } catch (error) {
        console.error('Command execution error:', error);
        if (!interaction.replied) {
            await interaction.reply({ 
                content: '❌ Command execute karne mein error aaya!', 
                ephemeral: true 
            });
        }
    }
});

// Login to Discord
if (!process.env.DISCORD_TOKEN) {
    console.error('DISCORD_TOKEN environment variable missing!');
    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);