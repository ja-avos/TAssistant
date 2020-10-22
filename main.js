const { app, BrowserWindow, session } = require('electron')
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const { net } = require('electron');
const { JSDOM } = require('jsdom');
const fs = require('fs');
//const extractor = require('./extractor/extractor.ts');

function createWindow () {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })

  const filter = {
    urls: ['https://uniandespiloto.brightspace.com/d2l/home']
  }

  const filterCourse = {
    urls: ['https://uniandespiloto.brightspace.com/d2l/home/*']
  }

  var credentials = ''

  // and load the index.html of the app.
  //win.loadURL('https://uniandespiloto.brightspace.com')

  loginCheck = true;
  activitiesGet = true;

  if(fs.existsSync('session.ses') ){
    loginCheck = false;
    fRead = fs.readFile('session.ses', "utf8", (err, data) => {
      if(err) throw err;
      credentials = data;
      sesVal = parseSession(data)[0];
      secVal = parseSession(data)[1];
      login(sesVal, secVal);
    });
  } else {
    win.loadFile('index.html')
  } 

  session.defaultSession.webRequest.onSendHeaders(filter, (details) => {
    if(loginCheck) {
      console.log("Headers sent: " + Object.getOwnPropertyNames(details.requestHeaders))
      console.log(JSON.stringify(win.webContents.session))
      let cookies = details.requestHeaders.Cookie
      writeFile('session.ses', cookies, 'Session')
      console.log("Cookie: " + cookies)
      params = cookies.split(";")
      if(params.length >= 2){
        val1 = params[0].split("=")[1];
        val2 = params[1].split("=")[1];
        login(val1, val2)
      }
      loginCheck = false;
    }
  })

  session.defaultSession.webRequest.onCompleted(filterCourse, (details) => {
    if(activitiesGet) {
      console.log(details.url.split('ou=')[1])
      getActivities(details.url.split('ou=')[1], credentials)
    }
    activitiesGet = false;
    session.defaultSession.webRequest.e
  })

  function login(sesVal, secSesVal){
    win.loadFile('logged.html', { query: { 'd2lSessionVal': sesVal, 'd2lSecureSessionVal': secSesVal }})
    getCourses(parseSession(credentials))
  }
  function getCourses(credentialsC){
    var courses = {}
    const cookie = { url: 'https://uniandespiloto.brightspace.com', name: 'd2lSessionVal', value: credentialsC[0] }
    const cookie2 = { url: 'https://uniandespiloto.brightspace.com', name: 'd2lSecureSessionVal', value: credentialsC[1] }
    session.defaultSession.cookies.set(cookie)
    .then(() => {
      session.defaultSession.cookies.set(cookie2)
    .then(() => {
      var request = net.request({
        method: 'GET',
        url: 'https://uniandespiloto.brightspace.com/d2l/le/manageCourses/search/6659',
        session: session.defaultSession,
        useSessionCookies: true,
      })
      request.on('response', (response) => {
        console.log(JSON.stringify(response.headers))
        response.on('data', (chunk) => {
          var doc = stripHtml(chunk)
          var res = doc.getElementsByClassName("d2l-grid-row")
          if(res.length>0){
            console.log("Courses: ")
            let coursesO = {}
            for(i = 0; i < res.length; i++){
              let cname = res[i].getElementsByClassName('d2l-link')[0].innerHTML
              let linkC = res[i].getElementsByClassName('d2l-link')[0].href.split('/')
              let code = linkC[linkC.length-1]
              coursesO[cname] = code
              console.log('\t'+cname+'\t'+code)
            }
            win.loadFile('courses.html', { query: coursesO})
          } else {
            console.log('No hay cursos.')
          }
        })
        response.on('end', () => {
          console.log('No more data in response.')
        })
      })
      request.end()
    }, (error) => {
      console.error(error)
    })
    }, (error) => {
      console.error(error)
    })
    return courses
  }

  function getActivities(courseId, credentialsA){
    var activities = null
    const cookie = { url: 'https://uniandespiloto.brightspace.com', name: 'd2lSessionVal', value: credentialsA[0] }
    const cookie2 = { url: 'https://uniandespiloto.brightspace.com', name: 'd2lSecureSessionVal', value: credentialsA[1] }
    session.defaultSession.cookies.set(cookie)
    .then(() => {
      session.defaultSession.cookies.set(cookie2)
    .then(() => {
      var request = net.request({
        method: 'GET',
        url: 'https://uniandespiloto.brightspace.com/d2l/lms/dropbox/admin/folders_manage.d2l?ou='+courseId,
        session: session.defaultSession,
        useSessionCookies: true,
      })
      request.on('response', (response) => {
        console.log(JSON.stringify(response))
        response.on('data', (chunk) => {
          var doc = stripHtml(chunk)
          var res = doc.querySelector('a.d2l-link')
          console.log('Query length: '+ res.length)
          // if(res.length>0){
          //   console.log("Courses: ")
          //   let coursesO = {}
          //   for(i = 0; i < res.length; i++){
          //     let cname = res[i].getElementsByClassName('d2l-link')[0].innerHTML
          //     let linkC = res[i].getElementsByClassName('d2l-link')[0].href.split('/')
          //     let code = linkC[linkC.length-1]
          //     coursesO[cname] = code
          //     console.log('\t'+cname+'\t'+code)
          //   }
          //   win.loadFile('courses.html', { query: coursesO})
          // } else {
          //   console.log('No hay cursos.')
          // }
        })
        response.on('end', () => {
          console.log('No more data in response.')
        })
      })
      request.end()
    }, (error) => {
      console.error(error)
    })
    }, (error) => {
      console.error(error)
    })
    return activities
  }
}

function parseSession(sessionTxt){
  var vals = sessionTxt.split(";");
  val1 = vals[0].split("=")[1];
  val2 = vals[1].split("=")[1];
  return [val1, val2]
}

function stripHtml(html){
  writeFile('strip.html', html, 'HTML')
  var doc = new JSDOM(html).window.document;
  return doc;
}

function writeFile(name, content, type){
  fs.writeFile(name, content, 'utf-8', function (err) {
    if(err){
      console.error("An error ocurred while trying to save " + type)
      console.error(err)
    } else {
      console.log(type + " saved.")
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    //extractor.test();
    createWindow();
  }
})
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.