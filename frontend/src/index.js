const state = { offset: { suggestions: 0, recentSearches: 0, search: 0 }, searchQuery: '' };

class PostReqOptions {
  constructor(bodyJSON) {
    this.method = 'POST';
    this.mode = 'cors';
    this.cache = 'no-cache';
    this.credentials = 'include';
    this.headers = { 'Content-Type': 'application/json' };
    this.body = JSON.stringify(bodyJSON);
  }
}

const getReqOptions = {
  method: "GET",
  credentials: "include",
  mode: "cors",
  cache: "no-cache"
}

function getCoordinates() {
  if (navigator.geolocation) {
    return navigator.geolocation.getCurrentPosition(setLocation);
  }
  return showMsg('Select location', 'warning');
}

function showMsg(msg, msgType) {
  let msgBox = document.getElementById('msg-box');
  if (msg == 'clear') {
    msgBox.innerHTML = '';
  } else {
    msgBox.innerHTML = `<div class="alert alert-${msgType}" role="alert">${msg}</div>`;
  }
}

async function setLocation(position) {
  try {
    const { latitude, longitude } = position.coords;
    const data = await fetchReq(`geocode/v1/json?key=${process.env.API_KEY}&q=${latitude}%2C%20${longitude}&pretty=1&no_annotations=1`, undefined, 'https://api.opencagedata.com/', 'Failed to detect location');
    const country = data.results[0].components.country;
    const countriesSupported = ["Pakistan", "India", "Bangladesh"];
    if (countriesSupported.includes(country)) {
      document.getElementById('location').value = country;
      fetchData(true, { types: ['suggestions', 'recentSearches'], offset: 0, country: country }, '');
    } else {
      throw new Error("Country not supported.Select location.");
    }
  } catch (err) {
    console.log("d");
    showMsg(err.message, "danger");
  }
}

async function fetchReq(path, options, endpoint = 'https://localhost:3000/', err = 'Server encountered an error') {
  const response = await fetch(endpoint + path, options);
  if (!response.ok) throw new Error(err);
  const data = await response.json();
  return data;
}

const locationSelect = document.getElementById('location');
locationSelect.onchange = function () {
  const country = locationSelect.value;
  if (country !== 'none') {
    showMsg('clear');
    resetState(state.offset, ['search', 'suggestions', 'recentSearches']);
    resetState(state, ['searchQuery']);
    fetchData(true, { types: ['suggestions', 'recentSearches'], offset: 0, country: country }, '');
  }
}

function resetState(partialState, stateKeys) {
  const defaultValues = { string: '', number: 0 };
  for (let i = 0; i < stateKeys.length; i++) {
    const type = typeof partialState[stateKeys[i]];
    partialState[stateKeys[i]] = defaultValues[type];
  }
}

async function fetchData(initial, bodyJSON, path) {
  try {
    const data = await fetchReq(path, new PostReqOptions(bodyJSON));
    if (initial) {
      renderCardsAndContainer(data);
    } else {
      const entries = Object.entries(data);
      appendCardsHTML(...entries[0]);
    }
  } catch (err) {
    console.log("f");
    showMsg(err.message, "danger")
  }
}

function appendCardsHTML(type, data) {
  if (data.length < 10) document.getElementById(type + 'Btn').disabled = true;
  if(data.length) document.getElementById(type).insertAdjacentHTML("beforeend", cardsHTML(data, type));
}

function cardsHTML(data, type) {
  let HTMLData = '';
  state.offset[type] += 10;
  for (let i = 0; i < data.length; i++) {
    HTMLData += `<div class="card col-sm-6 col-md-4 col-lg-3 m-2"><img class="card-img-top ad-img" src="https://localhost:3000/static/ads/${data[i].ad_id}" alt="Card image cap"><div class="card-body"><h5 class="card-title">${data[i].title}</h5><button name="${data[i].ad_id}" class="btn btn-primary card-btn">more info</button></div></div>`

  }
  return HTMLData;
}

function renderCardsAndContainer(data) {
  const headings = { suggestions: 'Suggestions', recentSearches: 'Recent Searches', search: `Search results for:${state.searchQuery}` };
  let HTMLData = '';
  for (const type in data) {
    HTMLData += `<div class="row">
    <h2 class="heading">${headings[type]}</h2>
    <div id="${type}" class="row">` + cardsHTML(data[type], type) + `</div></div>
    <button id="${type}Btn" ${data[type].length < 10 ? 'disabled' : ''} name="${type}" type="button" class="btn btn-outline-primary load-more">
    Load More</button>`;
  }
  document.getElementById("app").innerHTML = HTMLData;
}

function renderAd(details, issuedat, fullname, user_id, name, title, price) {
  const leftDiv = `<img class='ad-img' src="https://localhost:3000/static/ads/${name}"><div><h3 class='ad-title'>${title}</h3><p>${details}</p></div>`
  const rightDiv = `<div>${price}<br>Issued At: ${issuedat.slice(0, 10)}</div><h3>Seller Information</h3><img src='https://localhost:3000/static/profiles/${user_id}'>${fullname}`
  document.getElementById('app').innerHTML = `<div class="row">
  <div class="col-sm-12 col-lg-8">${leftDiv}</div>
  <div class="col-sm-12 col-lg-4">${rightDiv}</div>
  </div>`;
}

async function loginCheck() {
  try {
    const data = await fetchReq('users/login', getReqOptions);
    if (data.id === null)
      processLogout();
    else
      processLogin(data);
  } catch (err) {
    console.log("e");
    showMsg(err.message, "danger");
  }
}

async function processLogin({id,token}) {
  const {default:io} = await import('socket.io-client');
  const socket = io('https://localhost:3000',{query: {id,token}})
  const headerList = document.getElementById("header-list");
  headerList.innerHTML = `<li class="nav-item"><button name="Chat" class="btn btn-outline-success m-2">Chat</button></li><li class="nav-item dropdown"><a href="#" class="nav-link dropdown-toggle" data-toggle="dropdown"><img src="https://localhost:3000/static/profiles/${id}" width="40" height="40" class="rounded-circle"></a><div class="dropdown-menu dropdown-menu-right"><a name="Settings" href="#" class="dropdown-item">Settings</a><div class="dropdown-divider"></div><a name="Logout" href="#" class="dropdown-item">Logout</a></div></li>`;
  headerList.onclick = async function (e) {
    const name = e.target.name;
    if (name === "Chat") {
      document.getElementById('app').innerHTML = `<ul id="messages"></ul>
      <form id="chatForm">
        <input name="msg" id="msg" autocomplete="off" /><input type="submit" value="submit">
      </form>`;
      const chatForm = document.getElementById('chatForm');
      chatForm.onsubmit = function(e) {
        e.preventDefault();
        const msg = chatForm.msg.value;
        if (msg) {
          socket.emit('chat message',msg,'abc');
          chatForm.msg.value = '';
        }
      }
    } else if (name === "Logout") {
      try {
        await fetchReq('users/logout', getReqOptions);
        headerList.onclick = null;
        socket.disconnect()
        processLogout();
      } catch (err) {
        console.log('a');
        showMsg(err.message, 'danger');
      }
    } else if (name === "Settings") {

    }
  }
}

function processLogout() {
  const headerList = document.getElementById("header-list");
  headerList.innerHTML = `<li class="nav-item"><button name="Login" class="btn btn-outline-primary m-2" data-toggle="modal" data-target="#Modal">Login</button></li><li class="nav-item"><button name="Signup" class="btn btn-outline-primary m-2" data-toggle="modal" data-target="#Modal">Signup</button></li><div class="modal fade" id="Modal" tabindex="-1" role="dialog" aria-labelledby="ModalLabel" aria-hidden="true"><div class="modal-dialog" role="document"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="ModalLabel"></h5><button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button></div><div class="modal-body"></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button></div></div></div></div>`;
  $('#Modal').on('show.bs.modal', function (e) {
    const name = e.relatedTarget.name
    const modalTitle = document.getElementById("ModalLabel");
    modalTitle.textContent = name;
    if (name === 'Login') {
      modalBody.innerHTML = '<button name="loginFacebook" type="button" class="btn btn-outline-primary modal-btn">Login with Facebook</button><button name="loginGoogle" type="button" class="btn btn-outline-danger modal-btn">Login with Google</button><button name="loginEmail" type="button" class="btn btn-outline-success modal-btn">Login with Email</button>'
    } else if (name === 'Signup') {
      modalBody.innerHTML = '<form><div class="form-group"><label for="inputEmail">Email address</label><input name="inputEmail" type="email" class="form-control" id="inputEmail" aria-describedby="emailHelp" placeholder="Enter email"><small id="emailHelp" class="form-text text-muted">We\'ll never share your email with anyone else.</small></div><div class="form-group"><label for="inputPassword">Password</label><input name="inputPaswword" type="password" class="form-control" id="inputPassword" placeholder="Password"></div><div class="form-group"><label for="inputFullName">Full name</label><input name="inputFullName" type="text" class="form-control" id="inputFullName" placeholder="Randy Orton"></div><button data-dismiss="modal" type="button" name="signup" class="btn btn-primary">Sign up</button></form>'
    }
  })
  const modalBody = document.getElementsByClassName('modal-body')[0];
  modalBody.onclick = async function (e) {
    if (e.target.tagName !== 'BUTTON') return;
    const name = e.target.name;
    const methodsToLogin = ['loginFacebook', 'loginGoogle', 'loginEmail'];
    if (methodsToLogin.includes(name)) {
      if (name === 'loginEmail') {
        const html = '<form><div class="form-group"><label for="inputEmail">Email address</label><input name="inputEmail" type="email" class="form-control" id="inputEmail" aria-describedby="emailHelp" placeholder="Enter email"><small id="emailHelp" class="form-text text-muted">We\'ll never share your email with anyone else.</small></div><div class="form-group"><label for="inputPassword">Password</label><input name="inputPassword" type="password" class="form-control" id="inputPassword" placeholder="Password"></div><button data-dismiss="modal" type="button" name="login" class="btn btn-primary">Login</button></form>';
        modalBody.innerHTML = html;
      }
    } else {
      try {
        const email = e.target.parentNode.inputEmail.value;
        const password = e.target.parentNode.inputPassword.value;
        if (!(email && password)) return;
        if (name === 'login') {
          const data = await fetchReq('users/login', new PostReqOptions({ email, password }));
          if (data.err) throw new Error(data.err);
          processLogin(data);
        } else if (name === 'signup') {
          const fullName = e.target.parentNode.inputFullName.value;
          if (!fullName) return;
          const data = await fetchReq("users/signup", new PostReqOptions({ email, password, fullName }));
          if (data.err) throw new Error(data.err);
          processLogin(data.id);
        }
      } catch (err) {
        console.log("b")
        showMsg(err.message,"danger");
      }
    }
  }
}

function initiate() {
  const searchForm = document.getElementById('search-form');
  searchForm.onsubmit = function (e) {
    e.preventDefault();
    const searchQuery = searchForm.search.value;
    if (searchQuery && searchQuery !== state.searchQuery) {
      state.searchQuery = searchQuery;
      resetState(state.offset, ['search']);
      fetchData(true, { searchQuery: searchQuery, offset: state.offset.search }, 'search');
    }
  }

  const app = document.getElementById('app');
  app.onclick = async function (e) {
    if (e.target.tagName !== 'BUTTON') return;
    const name = e.target.name;
    if (name === 'suggestions' || name === 'recentSearches') {
      fetchData(false, { types: [name], offset: state.offset[name] }, '');
    } else if (name === 'search') {
      fetchData(false, { searchQuery: state.searchQuery, offset: state.offset.search }, 'search');
    } else {
      try {
        const { details, issuedat, fullname, user_id, price } = await fetchReq("ad", new PostReqOptions({ ad_id: name }));
        if (details && issuedat && fullname && user_id && price) {
          renderAd(details, issuedat, fullname, user_id, name, e.target.previousSibling.textContent, price)
        }
      } catch (err) {
        console.log("c")
        showMsg(err.message, "danger")
      }
    }
  }
  loginCheck();
  getCoordinates();
}
initiate();