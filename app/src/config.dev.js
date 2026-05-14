'use strict';

const os = require('os');

function getIPv4() {
    const ifaces = os.networkInterfaces();
    for (const interfaceName in ifaces) {
        const iface = ifaces[interfaceName];
        for (const { address, family, internal } of iface) {
            if (family === 'IPv4' && !internal) {
                return address;
            }
        }
    }
    return '0.0.0.0';
}

const IPv4 = getIPv4();

const numWorkers = require('os').cpus().length;

module.exports = {
    console: {
        timeZone: 'UTC',
        debug: true,
        colors: true,
    },
    server: {
        listen: {
            ip: '0.0.0.0',
            port: process.env.PORT || 3011,
        },
        ssl: {
            cert: '../ssl/cert.pem',
            key: '../ssl/key.pem',
        },
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
        recording: {
            enabled: false,
            endpoint: '',
            dir: 'rec',
        },
        rtmp: {
            enabled: false,
            fromFile: true,
            fromUrl: true,
            fromStream: true,
            maxStreams: 1,
            server: 'rtmp://localhost:1935',
            appName: 'mirotalk',
            streamKey: '',
            secret: 'mirotalkRtmpSecret',
            apiSecret: 'mirotalkRtmpApiSecret',
            expirationHours: 4,
            dir: 'rtmp',
            ffmpeg: '/usr/bin/ffmpeg',
        },
    },
    middleware: {
        IpWhitelist: {
            enabled: false,
            allowed: ['127.0.0.1', '::1'],
        },
    },
    api: {
        keySecret: process.env.CALLING_APP_API_SECRET || 'lms_calling_secret_2026',
        allowed: {
            meetings: true,
            meeting: true,
            join: true,
            token: true,
            slack: false,
        },
    },
    jwt: {
        key: 'mirotalksfu_jwt_secret',
        exp: '1h',
    },
    oidc: {
        enabled: false,
        config: {
            issuerBaseURL: 'https://server.example.com',
            baseURL: `http://localhost:${process.env.PORT ? process.env.PORT : 3011}`,
            clientID: 'clientID',
            clientSecret: 'clientSecret',
            secret: 'mirotalksfu-oidc-secret',
            authorizationParams: {
                response_type: 'code',
                scope: 'openid profile email',
            },
            authRequired: false,
            auth0Logout: true,
            routes: {
                callback: '/auth/callback',
                login: false,
                logout: '/logout',
            },
        },
    },
    host: {
        protected: false,
        user_auth: false,
        users_from_db: false,
        users_api_endpoint: 'https://webrtc.mirotalk.com/api/v1/user/isAuth',
        users_api_secret_key: 'mirotalkweb_default_secret',
        users: [
            {
                username: 'lms-system',
                password: 'lms-token',
                allowed_rooms: ['*'],
            },
        ],
    },
    presenters: {
        list: [
            'Ali Sher Abbasi',
            'alisher2161@gmail.com',
        ],
        join_first: true,
    },
    chatGPT: {
        enabled: false,
        basePath: 'https://api.openai.com/v1/',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        max_tokens: 1000,
        temperature: 0,
    },
    whisper: {
        enabled: process.env.WHISPER_ENABLED === 'true',
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'whisper-1',
        language: '',
        lmsApiUrl: process.env.LMS_API_URL || 'http://localhost:8082',
    },
    videoAI: {
        enabled: false,
        basePath: 'https://api.heygen.com',
        apiKey: '',
        systemLimit: 'You are a streaming avatar from Mualim Ul Quran.',
    },
    email: {
        alert: false,
        host: 'smtp.gmail.com',
        port: 587,
        username: 'your_username',
        password: 'your_password',
        sendTo: 'sfu.mirotalk@gmail.com',
    },
    ngrok: {
        enabled: false,
        authToken: '',
    },
    sentry: {
        enabled: false,
        DSN: '',
        tracesSampleRate: 0.5,
    },
    slack: {
        enabled: false,
        signingSecret: '',
    },
    IPLookup: {
        enabled: false,
        getEndpoint(ip) {
            return `https://get.geojs.io/v1/ip/geo/${ip}.json`;
        },
    },
    survey: {
        enabled: false,
        url: '',
    },
    redirect: {
        enabled: false,
        url: '',
    },
    ui: {
        brand: {
            app: {
                name: 'Mualim Ul Quran (Dev)',
                title: 'Mualim Ul Quran<br />Free browser based Real-time video calls.<br />Simple, Secure, Fast.',
                description: 'Start your next video call with a single click.',
            },
            site: {
                title: 'Mualim Ul Quran, Free Video Calls, Messaging and Screen Sharing',
                icon: '../images/logo.png',
                appleTouchIcon: '../images/logo.png',
            },
            meta: {
                description: 'Mualim Ul Quran powered by WebRTC and mediasoup.',
                keywords: 'webrtc, miro, mediasoup, mediasoup-client, self hosted',
            },
            og: {
                type: 'app-webrtc',
                siteName: 'Mualim Ul Quran',
                title: 'Click the link to make a call.',
                description: 'Mualim Ul Quran calling provides real-time video calls, messaging and screen sharing.',
            },
            html: {
                features: true,
                teams: true,
                tryEasier: true,
                poweredBy: true,
                sponsors: true,
                advertisers: true,
                footer: true,
            },
        },
        buttons: {
            main: {
                shareButton: false,
                hideMeButton: true,
                startAudioButton: true,
                startVideoButton: true,
                startScreenButton: true,
                swapCameraButton: true,
                chatButton: true,
                raiseHandButton: true,
                transcriptionButton: false,
                whiteboardButton: true,
                emojiRoomButton: false,
                settingsButton: true,
                aboutButton: true,
                exitButton: true,
            },
            settings: {
                fileSharing: true,
                lockRoomButton: true,
                unlockRoomButton: true,
                broadcastingButton: true,
                lobbyButton: true,
                sendEmailInvitation: false,
                micOptionsButton: true,
                tabRTMPStreamingBtn: true,
                tabModerator: true,
                tabVideoShare: false,
                tabProfile: false,
                tabRecording: true,
                host_only_recording: true,
                pushToTalk: true,
            },
            producerVideo: {
                videoPictureInPicture: true,
                fullScreenButton: true,
                snapShotButton: true,
                muteAudioButton: true,
                videoPrivacyButton: true,
            },
            consumerVideo: {
                videoPictureInPicture: true,
                fullScreenButton: true,
                snapShotButton: true,
                sendMessageButton: true,
                sendFileButton: false,
                sendVideoButton: false,
                muteVideoButton: true,
                muteAudioButton: true,
                audioVolumeInput: true,
                geolocationButton: false,
                banButton: false,
                ejectButton: false,
            },
            videoOff: {
                sendMessageButton: true,
                sendFileButton: false,
                sendVideoButton: false,
                muteAudioButton: true,
                audioVolumeInput: true,
                geolocationButton: false,
                banButton: false,
                ejectButton: false,
            },
            chat: {
                chatPinButton: true,
                chatMaxButton: true,
                chatSaveButton: true,
                chatEmojiButton: true,
                chatMarkdownButton: true,
                chatSpeechStartButton: true,
                chatGPT: true,
            },
            participantsList: {
                saveInfoButton: true,
                sendFileAllButton: false,
                ejectAllButton: false,
                sendFileButton: false,
                geoLocationButton: false,
                banButton: false,
                ejectButton: false,
            },
            whiteboard: {
                whiteboardLockButton: true,
            },
        },
    },
    stats: {
        enabled: false,
        src: 'https://stats.mirotalk.com/script.js',
        id: '41d26670-f275-45bb-af82-3ce91fe57756',
    },
    mediasoup: {
        numWorkers: numWorkers,
        worker: {
            logLevel: 'error',
            logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp', 'rtx', 'bwe', 'score', 'simulcast', 'svc', 'sctp'],
        },
        router: {
            audioLevelObserverEnabled: true,
            activeSpeakerObserverEnabled: false,
            mediaCodecs: [
                {
                    kind: 'audio',
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2,
                },
                {
                    kind: 'video',
                    mimeType: 'video/VP8',
                    clockRate: 90000,
                    parameters: { 'x-google-start-bitrate': 1000 },
                },
                {
                    kind: 'video',
                    mimeType: 'video/VP9',
                    clockRate: 90000,
                    parameters: { 'profile-id': 2, 'x-google-start-bitrate': 1000 },
                },
                {
                    kind: 'video',
                    mimeType: 'video/h264',
                    clockRate: 90000,
                    parameters: {
                        'packetization-mode': 1,
                        'profile-level-id': '4d0032',
                        'level-asymmetry-allowed': 1,
                        'x-google-start-bitrate': 1000,
                    },
                },
                {
                    kind: 'video',
                    mimeType: 'video/h264',
                    clockRate: 90000,
                    parameters: {
                        'packetization-mode': 1,
                        'profile-level-id': '42e01f',
                        'level-asymmetry-allowed': 1,
                        'x-google-start-bitrate': 1000,
                    },
                },
            ],
        },
        // DEV instance: UDP range 40100-40200 (prod uses 40000-40100, no overlap)
        webRtcServerActive: false,
        webRtcServerOptions: {
            listenInfos: [
                {
                    protocol: 'udp',
                    ip: '0.0.0.0',
                    announcedAddress: IPv4,
                    portRange: { min: 40100, max: 40100 + numWorkers },
                },
                {
                    protocol: 'tcp',
                    ip: '0.0.0.0',
                    announcedAddress: IPv4,
                    portRange: { min: 40100, max: 40100 + numWorkers },
                },
            ],
        },
        webRtcTransport: {
            listenInfos: [
                {
                    protocol: 'udp',
                    ip: '0.0.0.0',
                    announcedAddress: process.env.MEDIASOUP_ANNOUNCED_IP || IPv4,
                    portRange: { min: 40100, max: 40200 },
                },
                {
                    protocol: 'tcp',
                    ip: '0.0.0.0',
                    announcedAddress: process.env.MEDIASOUP_ANNOUNCED_IP || IPv4,
                    portRange: { min: 40100, max: 40200 },
                },
            ],
            initialAvailableOutgoingBitrate: 1000000,
            minimumAvailableOutgoingBitrate: 600000,
            maxSctpMessageSize: 262144,
            maxIncomingBitrate: 1500000,
        },
    },
};
