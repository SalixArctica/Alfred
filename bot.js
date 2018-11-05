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
        connection.playFile('./beep-07.mp3')
        .on('end', () => console.log(`recording!`));

        const filename = __dirname + '/audio/audio.wav';
        const receiver = connection.createReceiver();

        //setup wav/pcm output file
        let outputFileStream = new fileWriter(filename, {
            sampleRate: 48000,
            channels: 2
        });

        let voxStream;


        //when a user starts speaking, start recording
        connection.on('speaking', (user, speaking) => {
            if(speaking){ 
                

                //create stream
                voxStream = receiver.createPCMStream(user);

                //pipe to file
                voxStream.pipe(outputFileStream, {end: false});
            }
        })

        client.on('message', msg2 => {
            if(msg2.content.toLowerCase() == '!alfred stop') {

                connection.disconnect();

                outputFileStream.end();
                

                outputFileStream.on('end', () => {
                    console.log('doing sox conversion');
                    makeAudioMono(filename)
                    .then(() => {
                        console.log('conversion succeded!');
                        sendSpeechRequest(__dirname + '/audio/processed.wav')
                        .then(transcription => {
                            msg.reply(`transcription: ${transcription}`)
                            msg.delete();
                            msg2.delete();
                        })
                        .catch(err => console.log);
                    })
                    .catch(err => console.log);
                });
            }
        });
    });
  }
});

//login
client.login(process.env.DISCORD_TOKEN)
.catch(err => console.log(err));

const makeAudioMono = (filename) => {
    return new Promise((resolve, reject) => {
        //use sox cli to make audio mono
        exec(`sox ${filename} -r 16k -c 1 ${__dirname + '/audio/processed.wav'}`,(err, stdout, stderr) => {
            if(err) {
                console.log(err, stderr);
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

const sendSpeechRequest = (filename) => {
    return new Promise((resolve, reject) => {
        //setup google speech request
        const request = {
            config: {
                encoding: 'LINEAR16',
                sampleRateHertz: 16000,
                languageCode: 'en-US',
            },
            audio: {
                content: fs.readFileSync(filename).toString('base64')
            }
        };
        
        //Detects speech in the audio file
        speechClient
        .recognize(request)
        .then(data => {
            const response = data[0];
            const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');
            resolve(transcription);
        })
        .catch(err => {
            console.error('ERROR:', err);
            reject(err);
        });
    })
}