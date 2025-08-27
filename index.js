// index.js — Section 1: Setup & Event Handlers
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cron = require('node-cron');

// Move commands array to top, before any functions
const commands = [
  {
    name: 'profile',
    description: 'View or edit your profile',
    options: [
      { name: 'view', type: 1, description: 'View your profile' },
      { name: 'edit', type: 1, description: 'Edit your profile' }
    ]
  },
  {
    name: 'alliance',
    description: 'List or change your alliance',
    options: [
      { name: 'list', type: 1, description: 'List alliances' },
      { name: 'change', type: 1, description: 'Change your alliance' }
    ]
  },
  {
    name: 'onboard',
    description: 'Send onboarding DM to a specific user',
    options: [
      {
        name: 'user',
        description: 'The user to onboard',
        type: 6,
        required: true
      }
    ]
  },
  {
    name: 'onboard-all',
    description: 'Send onboarding DM to every member in the server'
  },
  {
    name: 'dashboard',
    description: 'View onboarding statistics'
  },
  {
    name: 'status',
    description: 'Check your onboarding status'
  },
  {
    name: 'reset-onboarding',
    description: 'Reset a user\'s onboarding profile',
    options: [
      {
        name: 'user',
        description: 'The user to reset',
        type: 6,
        required: true
      }
    ]
  }
];

const captchaRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('captcha_verify')
    .setLabel('✅ Verify Human')
    .setStyle(ButtonStyle.Success)
);

const profileRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('open_profile_modal')
    .setLabel('🖊️ Profile Info')
    .setStyle(ButtonStyle.Primary)
);


// Initialize bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember,
    Partials.Reaction,
    Partials.ThreadMember
  ]
});

// SQLite setup
const db = new sqlite3.Database('./onboarding.db');
db.run(`CREATE TABLE IF NOT EXISTS profiles (
  userId TEXT PRIMARY KEY,
  inGameName TEXT,
  timezone TEXT,
  language TEXT,
  alliance TEXT,
  verified INTEGER DEFAULT 0
)`);

// Progress bar helper
const PROGRESS_STEPS = ['Captcha', 'Profile Info', 'Alliance Selection'];
const buildBar = (step) => `Progress: [${'█'.repeat(step)}${'░'.repeat(PROGRESS_STEPS.length - step)}] ${step}/${PROGRESS_STEPS.length}`;

// Slash command registration
async function registerCommands(client) {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash commands registered');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
}

// On bot ready
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands(client);
});

// On member join
client.on(Events.GuildMemberAdd, async member => {
  try {
    await member.send({
      content: `Welcome to **${member.guild.name}**!\n\nStep 1: Human Verification\n${buildBar(0)}`,
      components: [captchaRow]
    });
  } catch (err) {
    console.error(`❌ Could not DM ${member.user.tag}`);
  }
});

// ---------------------------------- //
// index.js — Section 2: Interaction Handling (Captcha, Modal, Alliance, Slash Commands)

client.on(Events.InteractionCreate, async interaction => {
  const userId = interaction.user.id;
  
  // Handle DM-specific interactions first
  if (interaction.isButton()) {
    if (interaction.customId === 'captcha_verify') {
      db.get(`SELECT verified, alliance FROM profiles WHERE userId = ?`, [userId], async (err, row) => {
        if (row && row.verified && row.alliance) {
          return interaction.reply({
            content: `✅ You’ve already completed onboarding!\nAlliance: ${row.alliance}`,
            ephemeral: true
          });
        }

        db.run(`INSERT OR REPLACE INTO profiles (userId, verified) VALUES (?, 1)`, [userId], async err => {
          if (err) {
            console.error('Database error:', err);
            return await interaction.reply({ 
              content: '❌ An error occurred. Please try again.',
              ephemeral: true 
            });
          }
          await interaction.update({
            content: `Step 2: Complete Your Profile\n${buildBar(1)}`,
            components: [profileRow]
          });
        });
      });
      return;
    }
    if (interaction.customId === 'open_profile_modal') {
      const modal = new ModalBuilder()
        .setCustomId('profile_modal')
        .setTitle('Your Profile Info')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('inGameName')
              .setLabel('In-Game Name')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('timezone')
              .setLabel('Time Zone / Country')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('language')
              .setLabel('Preferred Language')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );
      await interaction.showModal(modal);
      return;
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === 'profile_modal') {
    try {
      const inGameName = interaction.fields.getTextInputValue('inGameName');
      const timezone = interaction.fields.getTextInputValue('timezone');
      const language = interaction.fields.getTextInputValue('language');

      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR REPLACE INTO profiles (userId, inGameName, timezone, language, verified) VALUES (?, ?, ?, ?, 1)`,
          [interaction.user.id, inGameName, timezone, language],
          err => err ? reject(err) : resolve()
        );
      });

      const allianceMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('alliance_select')
          .setPlaceholder('Select your alliance')
          .addOptions([
            { label: 'ANQA', value: 'ANQA', emoji: '💛' },
            { label: 'JAXA', value: 'JAXA', emoji: '🤍' },
            { label: 'MGXT', value: 'MGXT', emoji: '💜' },
            { label: '1ARK', value: '1ARK', emoji: '❤️' },
            { label: 'SPBG', value: 'SPBG', emoji: '💙' },
            { label: 'JAX2', value: 'JAX2', emoji: '🤎' },
            { label: 'ANK',  value: 'ANK',  emoji: '🩵' }
          ])
      );

      await interaction.update({
        content: `Step 3: Select Your Alliance\n${buildBar(2)}`,
        components: [allianceMenu]
      });
    } catch (err) {
      console.error('Profile submission error:', err);
      return interaction.reply({
        content: '❌ An error occurred while saving your profile.',
        ephemeral: true
      }).catch(() => null);
    }
    return;
  }

  // Handle alliance selection separately
  if (interaction.isStringSelectMenu() && interaction.customId === 'alliance_select') {
    try {
      const alliance = interaction.values[0];
      
      // Get guild - try interaction.guild first, then client cache
      let guild = interaction.guild;
      let member = null;

      if (!guild) {
        const guilds = Array.from(client.guilds.cache.values());
        guild = guilds[0];
        if (!guild) {
          return await interaction.reply({
            content: '❌ Could not find server. Please try again in the server.',
            ephemeral: true
          });
        }
      }

      // Get member
      member = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        return await interaction.reply({
          content: '❌ Could not verify your membership.',
          ephemeral: true
        });
      }

      // Get user profile from database
      await new Promise((resolve, reject) => {
        db.get(`SELECT inGameName, timezone, language FROM profiles WHERE userId = ?`, [interaction.user.id], async (err, row) => {
          if (err) {
            console.error('Database error:', err);
            reject(new Error('Database error'));
            return;
          }

          if (!row) {
            await interaction.reply({ content: 'Please complete your profile first.', ephemeral: true });
            reject(new Error('No profile found'));
            return;
          }

          // Find alliance role
          const role = guild.roles.cache.find(r => r.name === alliance);
          if (!role) {
            await interaction.reply({
              content: '❌ Alliance role not found. Please contact an admin.',
              ephemeral: true 
            });
            reject(new Error('Role not found'));
            return;
          }

          try {
            // Add role to member
            await member.roles.add(role);
            
            // Set nickname
            const nickname = `(${alliance}) ${row.inGameName}`;
            await member.setNickname(nickname).catch(() => null);
            
            // Update database
            db.run(`UPDATE profiles SET alliance = ? WHERE userId = ?`, [alliance, interaction.user.id], async (updateErr) => {
              if (updateErr) {
                console.error('Database update error:', updateErr);
                await interaction.reply({ 
                  content: '❌ An error occurred updating your profile.',
                  ephemeral: true 
                });
                reject(updateErr);
                return;
              }

              // Update interaction message
              await interaction.update({
                content: `✅ Onboarding Complete!\n${buildBar(3)}\nYour nickname is now **${nickname}**.`,
                components: []
              });

              // Send welcome message
              const welcomeCh = guild.channels.cache.find(c => c.name === 'welcome');
              if (welcomeCh?.isTextBased()) {
                welcomeCh.send({
                  content: `🎉 Welcome ${nickname}!\n🕒 Time Zone: ${row.timezone}\n🌐 Language: ${row.language}`
                });
              }

              // Send log message
              const logCh = guild.channels.cache.find(c => c.name === 'mod-log');
              if (logCh?.isTextBased()) {
                logCh.send({
                  content: `📝 Onboarding Log:\nUser: <@${interaction.user.id}>\nAlliance: ${alliance}\nTime Zone: ${row.timezone}\nLanguage: ${row.language}`
                });
              }

              resolve();
            });
          } catch (roleErr) {
            console.error('Role assignment error:', roleErr);
            await interaction.reply({ 
              content: '❌ Could not assign alliance role. Please contact an admin.',
              ephemeral: true 
            });
            reject(roleErr);
          }
        });
      });
    } catch (err) {
      console.error('Alliance selection error:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred during alliance selection.',
          ephemeral: true
        }).catch(() => null);
      }
    }
    return;
  }

  // All other slash commands require guild context
  if (!interaction.guild) {
    return interaction.reply({ 
      content: '❌ This command can only be used in a server.',
      ephemeral: true 
    });
  }

  // For guild-required interactions, get guild and member
  const guild = interaction.guild;
  const member = guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null;

  if (guild && !member) {
    return interaction.reply({ 
      content: '❌ Could not fetch your member data.',
      ephemeral: true 
    });
  }

  // SLASH COMMANDS
  if (interaction.isChatInputCommand()) {
    const sub = interaction.options.getSubcommand(false);

    // onboard command
    if (interaction.commandName === 'onboard') {
      await interaction.deferReply({ ephemeral: true });

      const target = interaction.options.getUser('user');
      if (target) {
        // Onboard a single user
        try {
          await target.send({
            content: '👋 Welcome! Let\'s get you onboarded.',
            components: [captchaRow]
          });
          await interaction.editReply({ content: `✅ Onboarding sent to ${target.tag}` });
        } catch (err) {
          await interaction.editReply({ content: `❌ Could not DM ${target.tag}. They may have DMs disabled.` });
          const logChannel = interaction.guild.channels.cache.find(c => c.name === 'mod-log');
          if (logChannel) {
            logChannel.send(`⚠️ Failed to onboard ${target.tag} — DMs may be blocked.`);
          }
        }
      } else {
        // Onboard everyone in the server
        const members = await interaction.guild.members.fetch();
        let success = 0, failed = 0;
        for (const member of members.values()) {
          if (member.user.bot) continue;
          try {
            await member.send({
              content: '👋 Welcome! Let\'s get you onboarded.',
              components: [captchaRow]
            });
            success++;
          } catch {
            failed++;
            const logChannel = interaction.guild.channels.cache.find(c => c.name === 'mod-log');
            if (logChannel) {
              logChannel.send(`⚠️ Failed to onboard ${member.user.tag} — DMs may be blocked.`);
            }
          }
        }
        await interaction.editReply({ content: `✅ Onboarding sent to ${success} users. ${failed} failed (DMs disabled).` });
      }
      return;
    }

    // onboard-all command
    if (interaction.commandName === 'onboard-all') {
      // Only allow admins to use this command
      if (!interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ 
          content: '❌ You must be an admin to use this command.',
          ephemeral: true 
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const members = await interaction.guild.members.fetch();
      let success = 0, failed = 0;
      for (const member of members.values()) {
        if (member.user.bot) continue;
        try {
          await member.send({
            content: '👋 Welcome! Let\'s get you onboarded.',
            components: [captchaRow]
          });
          success++;
        } catch {
          failed++;
          const logChannel = interaction.guild.channels.cache.find(c => c.name === 'mod-log');
          if (logChannel) {
            logChannel.send(`⚠️ Failed to onboard ${member.user.tag} — DMs may be blocked.`);
          }
        }
      }
      await interaction.editReply({ content: `✅ Onboarding sent to ${success} users. ${failed} failed (DMs disabled).` });
      return;
    }

    // dashboard command
    if (interaction.commandName === 'dashboard') {
      db.all(`SELECT * FROM profiles`, [], async (err, rows) => {
        const total = rows.length;
        const verified = rows.filter(r => r.verified).length;
        const profiled = rows.filter(r => r.inGameName && r.timezone && r.language).length;
        const withAlliance = rows.filter(r => r.alliance).length;

        const allianceCounts = {};
        rows.forEach(r => {
          if (r.alliance) {
            allianceCounts[r.alliance] = (allianceCounts[r.alliance] || 0) + 1;
          }
        });

        const allianceSummary = Object.entries(allianceCounts)
          .map(([name, count]) => `${name}: ${count}`)
          .join('\n');

        await interaction.reply({
          content: `📊 **Onboarding Stats**\nTotal Users: ${total}\n✅ Verified: ${verified}\n🖊️ Profiled: ${profiled}\n🛡️ Alliance Selected: ${withAlliance}\n\n**Alliance Breakdown:**\n${allianceSummary}`,
          ephemeral: true
        });
      });
      return;
    }

    // profile command
    if (interaction.commandName === 'profile') {
      db.get(`SELECT * FROM profiles WHERE userId = ?`, [userId], async (err, row) => {
        if (!row) return interaction.reply({ content: 'No profile found.', ephemeral: true });

        if (sub === 'view') {
          return interaction.reply({
            content: `👤 **Your Profile**\nName: ${row.inGameName}\nAlliance: ${row.alliance || 'None'}\nTime Zone: ${row.timezone}\nLanguage: ${row.language}`,
            ephemeral: true
          });
        }

        if (sub === 'edit') {
          const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_profile_modal').setLabel('🖊️ Edit Profile').setStyle(ButtonStyle.Primary)
          );
          return interaction.reply({ content: 'Click below to edit your profile:', components: [btn], ephemeral: true });
        }
      });
      return;
    }

    // alliance command
    if (interaction.commandName === 'alliance') {
      if (sub === 'list') {
        return interaction.reply({
          content: `Available alliances:\n💛 ANQA\n🤍 JAXA\n💜 MGXT\n❤️ 1ARK\n💙 SPBG\n🤎 JAX2\n🩵 ANK\n🖤 INTR\n💚 STH\n💕 ARCR`,
          ephemeral: true
        });
      }

      if (sub === 'change') {
        const allianceMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('alliance_select')
            .setPlaceholder('Select your new alliance')
            .addOptions([
              { label: 'ANQA', value: 'ANQA', emoji: '💛' },
              { label: 'JAXA', value: 'JAXA', emoji: '🤍' },
              { label: 'MGXT', value: 'MGXT', emoji: '💜' },
              { label: '1ARK', value: '1ARK', emoji: '❤️' },
              { label: 'SPBG', value: 'SPBG', emoji: '💙' },
              { label: 'JAX2', value: 'JAX2', emoji: '🤎' },
              { label: 'ANK',  value: 'ANK',  emoji: '🩵' },
              { label: 'INTR',  value: 'INTR',  emoji: '🖤' },
              { label: 'STH',  value: 'STH',  emoji: '💚' },
              { label: 'ARCR',  value: 'ARCR',  emoji: '💕' }

              
            ])
        );

        return interaction.reply({
          content: 'Select your new alliance:',
          components: [allianceMenu],
          ephemeral: true
        });
      }
      return;
    }

    // status command
    if (interaction.commandName === 'status') {
      db.get(`SELECT * FROM profiles WHERE userId = ?`, [userId], async (err, row) => {
        if (!row) {
          return interaction.reply({
            content: '❌ You have not started onboarding yet.',
            ephemeral: true
          });
        }

        const verified = row.verified ? '✅ Verified' : '❌ Not Verified';
        const alliance = row.alliance || '❌ Not Selected';
        const name = row.inGameName || '❌ Not Set';
        const timezone = row.timezone || '❌ Not Set';
        const language = row.language || '❌ Not Set';

        return interaction.reply({
          content: `📋 **Your Onboarding Status**\n${verified}\nAlliance: ${alliance}\nName: ${name}\nTime Zone: ${timezone}\nLanguage: ${language}`,
          ephemeral: true
        });
      });
      return;
    }

    // reset-onboarding command
    if (interaction.commandName === 'reset-onboarding') {
      if (!interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ 
          content: '❌ You must be an admin to use this command.',
          ephemeral: true 
        });
      }

      const target = interaction.options.getUser('user');
      const targetMember = await interaction.guild?.members.fetch(target.id).catch(() => null);
      
      if (!targetMember) {
        return interaction.reply({ 
          content: '❌ Could not find that user in the server.',
          ephemeral: true 
        });
      }

      db.run(`DELETE FROM profiles WHERE userId = ?`, [target.id], async err => {
        if (err) {
          return interaction.reply({ content: '❌ Failed to reset profile.', ephemeral: true });
        }

        // Optionally remove alliance roles
        const allianceRoles = ['ANQA', 'JAXA', 'MGXT', '1ARK', 'SPBG', 'JAX2', 'ANK'];
        for (const roleName of allianceRoles) {
          const role = interaction.guild.roles.cache.find(r => r.name === roleName);
          if (role && targetMember.roles.cache.has(role.id)) {
            await targetMember.roles.remove(role).catch(() => null);
          }
        }

        // Optionally reset nickname
        await targetMember.setNickname(null).catch(() => null);

        return interaction.reply({
          content: `✅ Reset onboarding profile for ${target.tag}`,
          ephemeral: true
        });
      });
      return;
    }
  }
});

// Add cron job for hourly stats
cron.schedule('0 * * * *', async () => {
  // Get first available guild or specific guild by ID
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const channel = guild.channels.cache.find(c => c.name === 'mod-log');
  if (!channel?.isTextBased()) return;

  db.all(`SELECT * FROM profiles`, [], async (err, rows) => {
    if (err || !rows) return;

    const total = rows.length;
    const verified = rows.filter(r => r.verified).length;
    const profiled = rows.filter(r => r.inGameName && r.timezone && r.language).length;
    const withAlliance = rows.filter(r => r.alliance).length;

    const allianceCounts = {};
    rows.forEach(r => {
      if (r.alliance) {
        allianceCounts[r.alliance] = (allianceCounts[r.alliance] || 0) + 1;
      }
    });

    const allianceSummary = Object.entries(allianceCounts)
      .map(([name, count]) => `${name}: ${count}`)
      .join('\n') || 'No data yet';

    const embed = new EmbedBuilder()
      .setTitle('📊 Hourly Onboarding Summary')
      .setDescription(`**Total Users:** ${total}\n✅ Verified: ${verified}\n🖊️ Profiled: ${profiled}\n🛡️ Alliance Selected: ${withAlliance}`)
      .addFields({ name: 'Alliance Breakdown', value: allianceSummary })
      .setColor(0x00AEFF)
      .setTimestamp();

    channel.send({ embeds: [embed] });
  });
});

// 🔚 Start the bot
client.login(process.env.BOT_TOKEN);


