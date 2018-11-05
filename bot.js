require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const wav = require('wav');
const fileWriter = wav.FileWriter;
const speech = require('@google-cloud/speech');
const { exec } = require('child_process');
const speechClient = new speech.SpeechClient();

//reference to audio directory
const audioDir = __dirname + '/audio/';

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



            //setup filenames/streams for each user in the channel
            let users = msg.member.voiceChannel.members.map(member => {
                return {
                    filename: member.id + '-' + Date.now().toString() + '.wav',
                    id: member.id,
                    stream: '',
                    name: member.displayName,
                    outfile: member.id + '-' + Date.now().toString() +  '.processed.wav',
                    transcript: ''
                }
            });

            //setup file streams for each user
            let fileWriters = users.map(user => {
                return new fileWriter(audioDir + user.filename, {
                    sampleRate: 48000,
                    channels: 2
                });
            })

            //play a beep so we can listen
            connection.playFile('./beep-07.mp3')
            .on('end', () => console.log(`recording!`));

            
            const receiver = connection.createReceiver();


            //when a user starts speaking, start recording
            connection.on('speaking', (user, speaking) => {
                
                if(speaking){ 
                    
                    //finds which user is currently speaking
                    let pos = users.map(user => user.id).indexOf(user.id);

                    //only record if user was there at beggining
                    if(pos != -1){
                        //create stream
                        users[pos].stream = receiver.createPCMStream(user);

                        //pipe to file
                        users[pos].stream.pipe(fileWriters[pos], {end: false});
                    }
                }
            })
            //check for stop message
            client.on('message', msg2 => {
                if(msg2.content.toLowerCase() == '!alfred stop') {

                    //disconnect
                    connection.disconnect();

                    //close all filestreams
                    fileWriters.forEach(writer => {
                        writer.end();
                    })

                    let filesConverted = 0;

                    //convert all to mono
                    console.log('doing sox conversion');
                    users.forEach(user => {
                        makeAudioMono(user.filename, user.outfile)
                        .then(() => {
                            console.log(`conversion for ${user.name} succeded!`)
                            filesConverted++;
                            if(filesConverted == users.length) {
                                sendAllRequests(users);
                            }
                        })
                        .catch((err) => console.log);
                    })
                    
                    const sendAllRequests = users => {

                        let output = '';

                        //get transcripts for all users
                        users.forEach(user => {
                            console.log('sending transcript request for ' + user.name);
                            sendSpeechRequest(audioDir + user.outfile)
                            .then(transcription => {
                                if(transcription != '') { 
                                    output += user.name + ': ' + transcription + '\n';
                                }
                            })
                            .then(() => msg.channel.send(output)) //SEND IT!
                            .then(() => {
                                fs.unlink(audioDir + user.filename)
                                .catch(err => console.log);
                                fs.unlink(audioDir + user.outfile)
                                .catch(err => console.log);
                            })
                            .catch(err => console.log);
                        })
                    }

                }
            });
        });
    }
});

//login
client.login(process.env.DISCORD_TOKEN)
.catch(err => console.log(err));

const makeAudioMono = (filename, outfile) => {
    return new Promise((resolve, reject) => {
        //use sox cli to make audio mono
        exec(`sox ${audioDir + filename} -r 16k -c 1 ${audioDir + outfile}`,(err, stdout, stderr) => {
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