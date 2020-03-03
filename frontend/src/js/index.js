require('dotenv').config()

function getLocation() {
  if (navigator.geolocation) {
    return navigator.geolocation.getCurrentPosition(sendLocation);
  }
  return showErr('Select location','warning');
}

function showMsg(msg,msgType) {
    let msgBox = document.getElementById('msg-box');
    if(msg == 'clear'){
        msgBox.innerHTML = '';
    }else{
        msgBox.innerHTML = `<div class="alert alert-${msgType}" role="alert">${msg}</div>`;
    }
}

function sendLocation(position) {
  const {latitude,longitude} = position.coords;
  fetch(`https://api.opencagedata.com/geocode/v1/json?key=${process.env.API_KEY}&q=${latitude}%2C%20${longitude}&pretty=1&no_annotations=1`)
  .then(response => response.json())
  .then(data => {
    let loc = data.results[0].components.country;
    let countries = ["Pakistan","India","Bangladesh"];
    if(countries.includes(loc)){
      document.getElementById('location').value = loc;
      //send location to backend from loc
    }else{
      throw new Error("Country not supported")
    }
  })
  .catch(err => showMsg(String(err).slice(7),'danger'))
}

const locSelect = document.getElementById('location');
locSelect.onchange = function(){
  let val = locSelect.value;
  if(val !== 'none'){
    showMsg('');
    //send location to backend from val
  }
  
}

getLocation()