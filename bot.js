require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const wav = require('wav');
const fileWriter = wav.FileWriter;
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient();
const opus = require('node-opus');
const { exec } = require('child_process');

const reader = new wav.Reader();

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
                let filename =`./audio/${user.username}.wav`
                console.log(filename)

                //create stream
                let voxStream = receiver.createPCMStream(user);

                //setup wav/pcm output file
                let outputFileStream = new fileWriter(filename, {
                    sampleRate: 48000,
                    channels: 2
                });

                //pipe to file
                voxStream.pipe(outputFileStream);

                //disconnect when user is done speaking
                voxStream.on('end', () => {
                    console.log(`disconnecting from ${msg.member.voiceChannel}`);
                    outputFileStream.on('end', () => {
                        exec(`sox ${filename} -r 48k -c 1 ${'./audio/processedAudio.wav'}`,(err, stdout, stderr) => {
                            if(err) {
                                console.log(err, stderr);
                                msg.reply('Sorry there was an error');
                            }
                            else {
                                const config = {
                                    encoding: 'LINEAR16',
                                    sampleRateHertz: 48000,
                                    languageCode: 'en-US',
                                  };
                                  const audio = {
                                    content: fs.readFileSync('./audio/processedAudio.wav').toString('base64'),
                                  };
                                  
                                  const request = {
                                    config: config,
                                    audio: audio,
                                  };
                                  
                                  // Detects speech in the audio file
                                  speechClient
                                    .recognize(request)
                                    .then(data => {
                                      const response = data[0];
                                      const transcription = response.results
                                        .map(result => result.alternatives[0].transcript)
                                        .join('\n');
                                      msg.reply(`Here is my transcription: ${transcription}`);
                                    })
                                    .catch(err => {
                                        console.error('ERROR:', err);
                                        msg.reply('Sorry there was an error');
                                    });
                            }
                        })
                    })
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