import * as fs from 'fs';
import * as sevenBin from '7zip-bin';
import { extractFull } from 'node-7z';
import { unrar } from 'unrar-promise';
import * as path from 'path';
import * as mv from 'mv';

module.exports = {
    extract: extract
};

class Intento {
    fecha: Date;
    path: string;

    constructor(fecha: Date, path: string) {
        this.fecha = fecha;
        this.path = path;
    }
}

async function extract(file: string, pathTo: string, del?: boolean) {
    let done = false;
    if (file.endsWith('.7z') || file.endsWith('.zip')) {
        var pathTo7zip = sevenBin.path7za;
        let ans = await new Promise((accept, reject) => {
            let zipP = extractFull(file, pathTo, {
                $bin: pathTo7zip
            });
            zipP.on('end', () => {
                accept(true);
            });
            zipP.on('error', reject);
        });

        if (del) {
            fs.unlinkSync(file);
        }

        return ans;
    } else if (file.endsWith('.rar')) {
        await unrar(file, pathTo);
        if (del) { fs.unlinkSync(file) }

    } else {
        throw Error('File not supported for extracting.');
    }
}

function getFolders(activityPath: string) {
    return fs.readdirSync(activityPath).filter(function (file) {
        return fs.statSync(activityPath + '/' + file).isDirectory();
    });
}

function createFolders(activityPath: string) {
    console.log('Creando folders');
    let folders = getFolders(activityPath);
    let folProp = {};
    for (const folder of folders) {
        let nameTmp = folder.split('-')[2];
        let name = getFormatName(nameTmp);
        let date = parseDate(folder.split('-')[3]);
        let oldPath = path.join(activityPath, folder);
        let intento = new Intento(date, oldPath);
        let folderPath = path.join(activityPath, name);

        if (!folProp.hasOwnProperty(name)) {
            folProp[name] = {
                'root': folderPath,
                'intentos': []
            }
        }

        folProp[name].intentos.push(intento);

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath);
        }
    }
    return folProp;
}

function fillFolders(folProp: any) {
    for (let name in folProp) {
        let folder = folProp[name].root;
        let ultimo: Intento = popUltimoIntento(folProp[name].intentos);
        try {
            moveContentAndUnzip(ultimo.path, folder);
        } catch (error) {
            console.log('Error moving content: ' + ultimo.path);
        }
        let oldF = path.join(folder, 'old');
        while (folProp[name].intentos.length != 0) {
            if (!fs.existsSync(oldF)) {
                fs.mkdirSync(oldF);
            }
            let inte = popUltimoIntento(folProp[name].intentos);
            let na = inte.fecha.toUTCString().replace(/:/g, '_');
            let nDate = path.join(oldF, na);
            if (!fs.existsSync(nDate)) {
                fs.mkdirSync(nDate);
            }
            moveContentAndUnzip(inte.path, nDate);
        }
    }
}

async function moveContentAndUnzip(fromFolder: string, toFolder: string) {
    let childs = fs.readdirSync(fromFolder);
    for (let child of childs) {
        let fromPath = path.join(fromFolder, child);
        let toPath = path.join(toFolder, child);
        let ans = new Promise((accept, reject) => {
            mv(fromPath, toPath, { mkdirp: true }, (err) => {
                if (err) {
                    reject(err)
                } else {
                    let m = unzipSubfile(toFolder);
                    m.then(() => { removeTrash(toFolder); });
                    fs.rmdirSync(fromFolder);
                    accept(true);
                }
            });
        });
    }
}

async function moveContent(fromFolder: string, toFolder: string) {
    let childs = fs.readdirSync(fromFolder);
    for (let child of childs) {
        let fromPath = path.join(fromFolder, child);
        let toPath = path.join(toFolder, child);
        mv(fromPath, toPath, { mkdirp: true }, (err) => { if (err) { console.error('ERROR moviendo content') } else { cleanFolder(toFolder); } });
    }
}

function removeTrash(folPath: any) {
    let found = false;
    let dirCon = fs.readdirSync(folPath);
    let parFol = getPyParentFolder(folPath);
    if (parFol != null) {
        found = true;
        if (parFol != folPath) {
            let a = moveContent(parFol, folPath);
        }
    }
    if (!found) {
        console.log('No se encontraron archivos .py en ' + folPath);
    }
}

function cleanFolder(folPath: string) {
    let files = fs.readdirSync(folPath);
    console.log(folPath + ' clean: ' + files);
    for(let a in files) {
        let aPath = path.join(folPath, files[a]);
        if(fs.statSync(aPath).isDirectory()) {
            console.log(aPath + ' : ' + fs.readdirSync(aPath).length);
            if(fs.readdirSync(aPath).length == 0) {
                removeFolder(aPath);
            } else {
                cleanFolder(aPath);
            }
        }
    }
}

function getPyParentFolder(initPath: string) {
    let resPath = null;
    let files = fs.readdirSync(initPath);
    for (let i in files) {
        if (fs.statSync(path.join(initPath, files[i])).isDirectory()) {
            if (files[i] == 'old') {
                continue;
            }
            if (files[i].toLowerCase().includes('pycache') || files[i].toLowerCase().includes('MACOS')) {
                removeFolder(path.join(initPath, files[i]));
            } else {
                resPath = getPyParentFolder(path.join(initPath, files[i]));
            }
        } else if (files[i].endsWith('.py') && resPath == null) {
            resPath = initPath;
        }
    }
    return resPath;
}

function removeFolder(folPath) {
    if (fs.existsSync(folPath)) {
        fs.readdirSync(folPath).forEach((file, index) => {
            const curPath = path.join(folPath, file);
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                removeFolder(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(folPath);
    }
};

async function unzipSubfile(folder: string) {
    let ans = undefined;
    let files = fs.readdirSync(folder);
    let zips = files.filter(file => file.endsWith('.zip') || file.endsWith('.7z') || file.endsWith('.rar'));
    if (zips.length != 1) {
        for (let zip of zips) {
            let pathZip = path.join(folder, zip);
            ans = new Promise((accept, reject) => {
                extract(pathZip, pathZip.substring(0, pathZip.length - 3), true).then(accept).catch(reject);
            });
        }
    } else {
        let pathZip = path.join(folder, zips[0]);
        ans = new Promise((accept, reject) => {
            extract(pathZip, folder, true).then(accept).catch(reject);
        });
    }
    return ans;
}

function popUltimoIntento(intentos: Array<Intento>) {
    let index: number = 0;
    for (let j = 1; j < intentos.length; j++) {
        let ultimo = intentos[index];
        let i = intentos[j]
        if (ultimo.fecha.getTime() < i.fecha.getTime()) {
            index = j;
        }
    }
    return intentos.splice(index, 1)[0];
}

function getFormatName(name: string) {
    let fmt = '';
    let name_s = name.trim().split(' ');
    fmt += name_s[name_s.length - 2] + ' ' + name_s[name_s.length - 1]
    for (let index = 0; index < name_s.length - 2; index++) {
        fmt += ' ' + name_s[index];
    }
    return fmt;
}

function parseMonth(name: string): number {
    let month = -1
    let months = {
        'enero': 0,
        'febrero': 1,
        'marzo': 2,
        'abril': 3,
        'mayo': 4,
        'junio': 5,
        'julio': 6,
        'agosto': 7,
        'septiembre': 8,
        'octubre': 9,
        'noviembre': 10,
        'diciembre': 11
    }

    if (months.hasOwnProperty(name)) {
        month = months[name];
    }

    return month;
}

function parseHour(old: string, sec: string) {
    let hour = Number(old);
    if (sec == 'p.m.') {
        hour += 12;
    }
    return hour;
}

function parseDate(rawDate: string) {
    let parts = rawDate.trim().replace(/de/g, '').split(' ').filter((wo) => { return wo != ''; });
    let day = Number(parts[0]);
    let month = parseMonth(parts[1]);
    let year = Number(parts[2]);
    let hour = parseHour(parts[3].split('_')[0], parts[4].replace('_', '.'));
    let minute = Number(parts[3].split('_')[1]);
    return new Date(year, month, day, hour, minute);
}

try {
    let basedir = './extractor/tests/t1/';
    basedir = 'C:/Users/javel/OneDrive - Universidad de Los Andes/Documentos/University/FifthSemester/Monitoria/P4/';
    let zipFile = basedir + 'Proyecto N4 Descargar 6 de  junio de 2020 624 p.m..zip';
    let b = extract(String.raw`${zipFile}`, String.raw`${basedir}`);
    let info = undefined;
    b.then(() => {
        info = createFolders(String.raw`${basedir}`);
        fillFolders(info);
    });
} catch (error) {
    console.error('There was an error!');
    //console.log(error);
}