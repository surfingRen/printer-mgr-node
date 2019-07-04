
const low = require('lowdb')
const _ = require('lodash')
const FileSync = require('lowdb/adapters/FileSync')
const adapter = new FileSync('db.json')
const db = low(adapter)
db.defaults({ printer: [], config: { host: 'localhost', port: 10000 } })
    .write()
const adapter2 = new FileSync('history.json')
const history = low(adapter2)
history.defaults({ printHistory: [] })
    .write()
const express = require('express')
const escpos = require('escpos')
const bodyParser = require('body-parser')
var randomId = require('random-id');
var net = require('net');

function scan() {
    console.log('scan printer')
    const printerList = db.get('printer').value()
    for (i = 0; i < printerList.length; i++) {
        var printer = printerList[i]
        console.log('---->', printer.ip, printer.port)
        new escpos.Network(printer.ip, printer.port)
            .open(function (error, self, param) {
                if (error == undefined) {
                    console.log('---->', param.ip, param.port, 1)
                    db.get('printer').find({ id: param.id })
                        .assign({ status: 1 }).write()
                    // self.close()
                }
            }, function (param) {
                console.log('---->', param.ip, param.port, 0)
                db.get('printer').find({ id: param.id })
                    .assign({ status: 0 }).write()
            }, printer)
    }
    console.log('scan printer end')
}

scanStatus = function () {
    // setInterval(function () {
    scan()
    // }, 3000)
}

start = function () {

    // 连接服务端, 同步打印机状态
    connectionServer()

    port = 3601
    url = 'http://localhost:' + port
    console.log('重连', url, port)
    const app = express()
    app.use(bodyParser.json())
        .use(express.static('public'))
        .all('*', function (req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Content-Type,Content-Length, Authorization, Accept,X-Requested-With,sessionToken");
            res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
            res.header("X-Powered-By", ' 3.2.1')
            if (req.method == "OPTIONS") res.send(200);/*让options请求快速返回*/
            else next();
        })


    app.get('/printer/:id', (req, res) => {
        console.log(req.params)
        res.send(getPrinter(req.params.id))
    })

    app.get('/printer', function (req, res) {
        res.send(db.get('printer').value())
    })

    app.get('/history', function (req, res) {
        res.send(_.orderBy(history.get('printHistory').value(), 'time', 'desc'))
    })

    app.post('/printer', (req, res) => {
        result = db.get('printer')
            .find({ ip: req.body.ip, port: req.body.port })
            .value()

        console.log(result)
        if (result) {
            res.send({ msg: '已存在' })
            return
        }
        console.log(req.body)
        id = getId()
        db.get('printer')
            .push(req.body)
            .last()
            .assign({ id: id, status: 0 })
            .write()

        scan()

        res.send(getPrinter(id))

    })

    app.post('/print', function (req, res) {
        // console.log(req.params)
        // console.log(req.body)

        // 生成 ID
        id = getId()

        // 保存
        history.get('printHistory')
            .push({ pid: req.body.pid, id: id, content: req.body, status: 0, time: datetimeFormat_1(new Date()) })
            .last().assign({ id: id }).write()

        // 查询
        info = history.get('printHistory')
            .find({ id: id })
            .value()

        // 打印
        printOrder(info)

        // 返回
        res.send(info)

    })


    app.get('/printer/:id', (req, res) => {
        console.log(req.params)
        res.send(getPrinter(req.params.id))
    })

    function getPrinter(id) {
        return db.get('printer')
            .find({ id: id })
            .value()
    }
    app.get('/config', function (req, res) {
        res.send(db.get('config').value())
    })

    app.post('/config', function (req, res) {
        db.set('config.host', req.body.host).write()
        db.set('config.port', req.body.port).write()
        res.send(db.get('config').value())
    })

    app.get('/printer', function (req, res) {
        res.send(db.get('printer').value())
    })

    app.get('/history', function (req, res) {
        res.send(history.get('printHistory').sortBy('time', 'desc').value())
    })

    app.post('/printer', (req, res) => {
        result = db.get('printer')
            .find({ ip: req.body.ip, port: req.body.port })
            .value()

        console.log(result)
        if (result) {
            res.send({ msg: '已存在' })
            return
        }
        console.log(req.body)
        id = getId()
        db.get('printer')
            .push(req.body)
            .last()
            .assign({ id: id, status: 0 })
            .write()

        scan()

        res.send(getPrinter(id))

    })

    app.listen(port, () => console.log('server is running, ', url))

    return url

}

function getPrinter(id) {
    return db.get('printer')
        .find({ id: id })
        .value()
}

function getId() {
    // var len = 30;
    // var pattern = 'aA0'
    return randomId()
}

function printOrder(info) {

    if (!info||!info.pid) {
        console.error('没有提供打印机 id 参数')
        return
    }

    myprinter = db.get('printer')
        .find({ id: info.pid })
        .value()

    if (!myprinter) {
        console.error('打印机 id:', info.pid, '不存在')
        return
    }

    id = info.id
    ip = myprinter.ip
    port = myprinter.port
    console.log(ip, port)

    const device = new escpos.Network(ip, port)
    const options = { encoding: "GB18030" /* default */ }
    const printer = new escpos.Printer(device, options)

    device.open(function (error, self) {
        // 没有异常
        if (error == undefined) {
            // 打印
            printer
                .font('a')
                .align('ct')
                .style('bu')
                .size(1, 1)
                .text(info.content.title)
                .align('lt')
                .text('桌号: ' + info.content.desk)
                .text('单号: ' + info.content.deskNum)
                .align('rt')
                .size(1.5, 1.5)
                .text('时间: ' + datetimeFormat_1(new Date()))
                .text('-------------------------------------------')
                .size(2, 2)
                .align('lt')
            for (i = 1; i <= info.content.list.length; i++) {
                printer.text(i + '. ' + info.content.list[i - 1])
            }
            printer.text('')
                .text('')
                .cut()
                .close()
            // 修改打印成功
            history.get('printHistory')
                .find({ id: id })
                .assign({ status: 1 })
                .write()
            console.log(ip, port, ' print success')
        }
    }, function () {
        history.get('printHistory')
            .find({ id: id })
            .assign({ error: '无法连接打印机' })
            .write()
        console.log(ip, port, ' connection error')
    })
}

function connectionServer() {
    var net = require('net');

    config = db.get('config').value();
    var PORT = config.port;
    var HOST = config.host;
    // tcp客户端
    var client = net.createConnection(PORT, HOST);
    client.setEncoding('utf8');
    client.on('connect', function () {
        console.log('客户端：已经与服务端建立连接');
        db.get('config').set('status', '1').write()
    });
    client.on('error', function () {
        console.log('客户端：连接异常');
        db.get('config').set('status', '0').write()
    })

    client.on('data', function (data) {
        console.log(data.indexOf('print::'))
        // 打印(id,text)
        if (data.indexOf('print::') == 0) {
            try {

                console.log(data.split('print::'))
                obj = JSON.parse(data.split('print::')[1])

                console.log('收到打印命令:', obj)

                id = obj.id
                content = obj.content

                result = history.get('printHistory').find({ id: id }).value()

                if (result) {
                    console.log('已存在:', id)
                    // 100 -> 已存在
                    client.write(JSON.stringify({ id: id, status: 100 }))
                    return
                }

                history.get('printHistory').push(obj).write()

                printOrder(obj)

                // 返回 id, status 0 表示 已接收
                client.write(JSON.stringify({ id: id, status: 0 }))
            } catch (e) {
                console.error('print error', e.message)
            }
        }

        if (data.indexOf('print2::') == 0) {
            try {

                console.log(data.split('print2::'))

                obj = JSON.parse(data.split('print2::')[1])

                console.log('收到打印命令:', obj)

                id = obj.id
                content = obj.content

                result = history.get('printHistory').remove({ id: id }).value()

                if (result) {
                    console.log('已存在:', id)
                    history.get('printHistory').remove({ id: id }).write()
                    console.log('删除:', id)
                }

                history.get('printHistory').push(obj).write()

                printOrder(obj)

                // 返回 id, status 0 表示 已接收
                client.write(JSON.stringify({ id: id, status: 0 }))
            } catch (e) {
                console.error('print error', e.message)
            }
        }
        // 状态查询
        if (data.indexOf('printStatus::') == 0) {
            console.log(data.split('printStatus::'))
            id = data.split('printStatus::')[1]
            result = db.get('printer')
                .find({ ip: obj.ip, port: obj.port })
                .value()
            console.log(result)
            if (result) {
                client.write(JSON.stringify({ msg: 'existed' }))
                return
            }
            id = getId()
            db.get('printer')
                .push(obj)
                .last()
                .assign({ id: id })
                .write()
            client.write(JSON.stringify(getPrinter(id)))
        }
        if (data.indexOf('printer::') == 0) {
            client.write('printer list')
        }
        if (data.indexOf('addPrinter::') == 0) {
            console.log(data.split('addPrinter::'))
            obj = JSON.parse(data.split('addPrinter::')[1])
            console.log(obj)
            result = db.get('printer')
                .find({ ip: obj.ip, port: obj.port })
                .value()
            console.log(result)
            if (result) {
                client.write(JSON.stringify({ msg: 'existed' }))
                return
            }
            id = getId()
            db.get('printer')
                .push(obj)
                .last()
                .assign({ id: id })
                .write()
            client.write(JSON.stringify(getPrinter(id)))
        }
    });

    client.on('close', function (data) {
        console.log('客户端：连接断开');
        db.get('config').set('status', '0').write()
        setTimeout(function () {
            console.log('重连')
            connectionServer()
        }, 30000)
    });

    // client.end('你好，我是客户端');
}

function datetimeFormat(longTypeDate) {
    var datetimeType = "";
    var date = new Date();
    date.setTime(longTypeDate);
    datetimeType += date.getFullYear(); //年
    datetimeType += "-" + getMonth(date); //月
    datetimeType += "-" + getDay(date); //日
    return datetimeType;
}

function datetimeFormat_1(longTypeDate) {
    var datetimeType = "";
    var date = new Date();
    date.setTime(longTypeDate);
    datetimeType += date.getFullYear(); //年
    datetimeType += "-" + getMonth(date); //月
    datetimeType += "-" + getDay(date); //日
    datetimeType += " " + getHours(date); //时
    datetimeType += ":" + getMinutes(date); //分
    datetimeType += ":" + getSeconds(date); //分
    return datetimeType;
}

function datetimeFormat_2(longTypeDate) {
    var datetimeType = "";
    var date = new Date();
    date.setTime(longTypeDate);
    datetimeType = date.getFullYear() + "-" + getMonth(date) + "-" + getDay(date) + "&nbsp;" + getHours(date) + ":" + getMinutes(date) + ":" + getSeconds(date); //yyyy-MM-dd 00:00:00格式日期
    return datetimeType;
}

function datetimeFormat_3(longTypeDate) {
    var datetimeType = "";
    var date = new Date();
    date.setTime(longTypeDate);
    datetimeType = date.getFullYear() + "/" + getMonth(date) + "/" + getDay(date); //yyyy-MM-dd 00:00:00格式日期
    return datetimeType;
}


//返回 01-12 的月份值
function getMonth(date) {
    var month = "";
    month = date.getMonth() + 1; //getMonth()得到的月份是0-11
    if (month < 10) {
        month = "0" + month;
    }
    return month;
}
//返回01-30的日期
function getDay(date) {
    var day = "";
    day = date.getDate();
    if (day < 10) {
        day = "0" + day;
    }
    return day;
}
//返回小时
function getHours(date) {
    var hours = "";
    hours = date.getHours();
    if (hours < 10) {
        hours = "0" + hours;
    }
    return hours;
}
//返回分
function getMinutes(date) {
    var minute = "";
    minute = date.getMinutes();
    if (minute < 10) {
        minute = "0" + minute;
    }
    return minute;
}
//返回秒
function getSeconds(date) {
    var second = "";
    second = date.getSeconds();
    if (second < 10) {
        second = "0" + second;
    }
    return second;
}


start()

scan()