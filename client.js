const connection = new WebSocket('wss://api.demo-oulhafiane.me:443')
const loginPage = document.querySelector('#login-page')
const usernameInput = document.querySelector('#username')
const loginButton = document.querySelector('#login')
const callPage = document.querySelector('#call-page')
const theirUsernameInput = document.querySelector('#their-username')
const callButton = document.querySelector('#call')
const hangUpButton = document.querySelector('#hang-up')
const yourVideo = document.querySelector('#yours')
const theirVideo = document.querySelector('#theirs')
let yourConnection
let name
let connectedUser

function hasUserMedia() {
  return !!navigator.mediaDevices.getUserMedia
}

function hasRTCPeerConnection() {
  window.RTCPeerConnection =
    window.RTCPeerConnection ||
    window.webkitRTCPeerConnection ||
    window.mozRTCPeerConnection
  return !!window.RTCPeerConnection
}

function setupPeerConnection() {
  //var configuration = {
  // "iceServers": [{ "url": "stun.l.google.com:19302" }]
  //};
  yourConnection = new RTCPeerConnection()

  // Setup ice handling
  yourConnection.onicecandidate = event => {
    console.log('on ice candidate now')
    if (event.candidate) send({ type: 'candidate', candidate: event.candidate })
  }

  yourConnection.onicegatheringstatechange = event => {
    console.log('*****ICe mine gathering : ' + yourConnection.iceGatheringState)
  }

  yourConnection.onnegotiationneeded = () => {
    console.log('*** creation Offer ***')
    yourConnection
      .createOffer()
      .then(offer => {
        console.log('*** creatiiiing Offer 1111 ***')
        return yourConnection.setLocalDescription(offer)
      })
      .then(() => {
        console.log('Sending offer to remore peer')
        send({
          type: 'offer',
          offer: yourConnection.localDescription,
          otherName: connectedUser,
        })
      })
  }

  yourConnection.ontrack = function(e) {
    console.log('my ontrack now')
    theirVideo.srcObject = e.streams[0]
  }
}

function startMedia() {
  console.log("Has user media ? " + hasUserMedia())
  if (hasUserMedia()) {
    console.log(navigator.mediaDevices.getUserMedia({ video: true, audio: true }))
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then(stream => {
        yourVideo.srcObject = stream
        stream
          .getTracks()
          .forEach(track => yourConnection.addTrack(track, stream))
      })
      .catch(error => {
        console.log('Kayn error hna')
        console.log(error)
      })
  } else {
    alert('Sorry, your browser does not support WebRTC.')
  }
}

function onLogin(success) {
  if (success === false) alert('Login failed, try another username')
  else {
    console.log('connected')
    loginPage.style.display = 'none'
    callPage.style.display = 'block'
    //startConnection();
  }
}

function onOffer(offer, name) {
  console.log('getting offer')
  connectedUser = name
  setupPeerConnection()
  yourConnection
    .setRemoteDescription(new RTCSessionDescription(offer))
    .then(() => {
      console.log('Setting up the local media stream.')
      if (hasUserMedia()) {
        navigator.mediaDevices
          .getUserMedia({ video: true, audio: false })
          .then(stream => {
            yourVideo.srcObject = stream
            stream
              .getTracks()
              .forEach(track => yourConnection.addTrack(track, stream))
            yourConnection.createAnswer().then(answer => {
              console.log('Setting local localDescription after createAnswer')
              yourConnection.setLocalDescription(answer).then(() => {
                console.log('Sending answer packet back to other peer')
                send({
                  type: 'answer',
                  answer: yourConnection.localDescription,
                })
              })
            })
          })
          .catch(error => {
            console.log(error)
          })
      } else {
        alert('Sorry, your browser does not support WebRTC.')
      }
    })
}

function onAnswer(answer) {
  console.log('getting answer')
  yourConnection.setRemoteDescription(new RTCSessionDescription(answer))
}

function onCandidate(candidate) {
  console.log('getting candidate')
  yourConnection.addIceCandidate(new RTCIceCandidate(candidate))
}

function onLeave() {
  connectedUser = null
  theirVideo.srcObject = null
  yourConnection.close()
  yourConnection.onicecandidate = null
  yourConnection.ontrack = null
  yourConnection.onicegatheringstatechange = null
  yourConnection.onnegotiationneeded = null
}

function send(msg) {
  console.log('sending msg : ' + JSON.stringify(msg))
  connection.send(JSON.stringify(msg))
}

connection.onopen = () => {
  console.log('Connecting...')
}
connection.onmessage = message => {
  let data

  console.log(`Got a message ${message.data}`)
  data = JSON.parse(message.data)
  switch (data.type) {
    case 'login':
      onLogin(data.success)
      break
    case 'offer':
      onOffer(data.offer, data.otherName)
      break
    case 'answer':
      onAnswer(data.answer)
      break
    case 'candidate':
      onCandidate(data.candidate)
      break
    case 'leave':
      onLeave()
      break
    default:
      break
  }
}
connection.onerror = err => {
  console.log('Got error', err)
}

loginButton.addEventListener('click', event => {
  name = usernameInput.value
  console.log('login button clicked')
  if (name.length > 0) send({ type: 'login', name })
})

callButton.addEventListener('click', () => {
  connectedUser = theirUsernameInput.value
  console.log('call button clicked, theirUsername : ' + connectedUser)
  if (connectedUser.length > 0) {
    console.log('setupPeerConnection started.')
    setupPeerConnection()
    console.log('startMedia started.')
    startMedia()
  }
})

hangUpButton.addEventListener('click', () => {
  send({ type: 'leave' })
  onLeave()
})
