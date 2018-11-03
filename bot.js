require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const wav = require('wav');
const fileWriter = wav.FileWriter;
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient();

//ready up!
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

//deal with message
client.on('message', msg => {

    //check message
  if (msg.content === '!alfred') {

    //join the channel
    msg.member.voiceChannel.join()
    .then(connection => {
        console.log(`joined channel ${msg.member.voiceChannel}`)

        //play a beep so we can listen
        const receiver = connection.createReceiver();
        connection.playFile('./beep-07.mp3')
        .on('end', () => console.log(`beeped!`));

        //when a user starts speaking, start recording
        connection.on('speaking', (user, speaking) => {
            if(speaking){ 

                console.log(`recording to ${user.username}.wav`)

                //create stream
                let voxStream = receiver.createPCMStream(user)

                //setup output file
                let outputFileStream = new fileWriter(`./audio/${user.username + Date()}.wav`, {
                    sampleRate: 96000, //double the Hz of the stream cause it sounds slow otherwise
                    channels: 1
                });

                //pipe to file
                voxStream.pipe(outputFileStream);

                //disconnect when user is done speaking
                voxStream.on('end', () => {
                    console.log(`disconnecting from ${msg.member.voiceChannel}`);
                    connection.disconnect();
                });
            }
        })
    })
  }
});

//login
client.login(process.env.DISCORD_TOKEN)
.catch(err => console.log(err));