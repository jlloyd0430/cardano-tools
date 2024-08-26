require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');

const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const TOKEN = process.env.TOKEN;
const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.BASE_URL;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ],
});

const commands = [
    new SlashCommandBuilder()
        .setName('snap')
        .setDescription('Take a snapshot of Cardano NFTs by policy ID')
        .addStringOption(option => 
            option.setName('policy_id')
            .setDescription('The policy ID of the Cardano NFT collection')
            .setRequired(true)
        ),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'snap') {
        const policyId = interaction.options.getString('policy_id');
        console.log('Policy ID received:', policyId);

        let nextCursor = null;
        let allData = [];

        try {
            do {
                const url = `${BASE_URL}/policy/${policyId}/addresses`;
                const response = await axios.get(url, {
                    headers: {
                        'api-key': API_KEY,
                    },
                    params: {
                        count: 100, // You can adjust this count as needed
                        cursor: nextCursor, // Handle pagination
                    },
                });

                const data = response.data.data;
                allData = allData.concat(data);

                nextCursor = response.data.next_cursor;

            } while (nextCursor);

            console.log('Total holders retrieved:', allData.length);

            const snapshot = allData.map(item => {
                const assetCount = item.assets.length;
                return `Address: ${item.address}\nAssets: ${assetCount}\n\n`;
            }).join('\n');

            const fileName = `snapshot_${policyId}.txt`;
            fs.writeFileSync(fileName, snapshot);

            await interaction.reply({
                content: 'Here is your snapshot:',
                files: [fileName],
            });

            fs.unlinkSync(fileName);

        } catch (error) {
            console.error('Error fetching data from API:', error);
            await interaction.reply('There was an error fetching the data. Please try again.');
        }
    }
});

client.login(TOKEN);
