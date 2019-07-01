# 打印机管理

![](image.png)

1. 建立 socket 通道, 通道失败, 30 秒重连接
2. 打印请求(json 格式)
    - 打印机 ID
    - 打印流水 ID
    - 时间
    - 内容

已知问题: 服务器端未处理多个客户端打印机管理的问题, 即 java 端如果收到新的socket 连接,会丢失之前的连接(连接不会中断, 但是不再会受到请求, 解决方案: 可以增加连接验证)

## 快速开始

```
git clone https://github.com/surfingRen/printer-mgr-node.git

cd printer-mgr-node

npm install 

# 覆盖 network.js
cp network.js ./node_modules/escpos/adapter/network.js

npm start
```
调用打印,依赖 escpos 模块
适配器 network 并无同步代码实现, 增加异步的异常处理机制

> network.js
```
'use strict';
const net = require('net');
const util = require('util');
const EventEmitter = require('events');
/**
 * Network Adapter
 * @param {[type]} address
 * @param {[type]} port
 */
function Network(address, port, timeout) {
  EventEmitter.call(this);
  this.address = address;
  this.port = port || 9100;
  this.device = new net.Socket();
  this.device.setTimeout(timeout || 10000)
  return this;
};

util.inherits(Network, EventEmitter);

/**
 * connect to remote device
 * @praram {[type]} callback
 * @return
 */
Network.prototype.open = function (callback, errorCallback, param) {
  var self = this;
  //connect to net printer by socket (port,ip)
  this.device.on("error", (err) => {
    callback && callback(err, self.device, param);
  }).on('data', buf => {
    // console.log('printer say:', buf);
  }).on('error', function (error) {
    // console.log('11-12-1-2-1--2-======',error)
    errorCallback(param)
  })
    .connect(this.port, this.address, function (err) {
      self.emit('connect', self.device);
      callback && callback(err, self.device, param);
    })
  return this;
};

/**
 * write data to printer
 * @param {[type]} data -- byte data
 * @return 
 */
Network.prototype.write = function (data, callback) {
  this.device.write(data, callback);
  return this;
};

/**
 * [close description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Network.prototype.close = function (callback) {
  if (this.device) {
    this.device.destroy();
    this.device = null;
  }
  this.emit('disconnect', this.device);
  callback && callback(null, this.device);
  return this;
}

module.exports = Network;

```

## 服务端 - java

依赖 jar 包
> gradle.build
```
    compile 'com.alibaba:fastjson:1.2.58'
    compile 'net.sf.json-lib:json-lib:2.4:jdk13'
    compile 'com.alipay.sdk:alipay-sdk-java:3.0.52.ALL'
    compile 'com.github.binarywang:weixin-java-mp:3.3.0'
    compile group: 'commons-httpclient', name: 'commons-httpclient', version: '3.1'
    implementation('org.springframework.boot:spring-boot-starter-actuator')
    implementation('org.springframework.boot:spring-boot-starter-cache')
    implementation('org.springframework.boot:spring-boot-starter-data-jpa')
    implementation('org.springframework.boot:spring-boot-starter-data-redis')
    implementation('org.springframework.boot:spring-boot-starter-quartz')
    implementation('org.springframework.boot:spring-boot-starter-thymeleaf')
    implementation('org.springframework.boot:spring-boot-starter-web')
    implementation('org.springframework.boot:spring-boot-starter-websocket')
    implementation('org.springframework.boot:spring-boot-starter-freemarker')
    implementation('com.spring4all:swagger-spring-boot-starter:1.8.0.RELEASE')
    implementation('com.alibaba:druid-spring-boot-starter:1.1.10')
    implementation 'mysql:mysql-connector-java:5.1.47'
    implementation 'com.github.obiteaaron:pinyin4j-multi:1.0.0'
    implementation 'org.apache.oltu.oauth2:org.apache.oltu.oauth2.authzserver:1.0.0'
    implementation 'com.google.code.gson:gson:2.6.2'
    implementation('org.projectlombok:lombok')
    compile group: 'org.apache.poi', name: 'poi', version: '4.0.1'
    compile 'com.jayway.jsonpath:json-path:2.4.0'
    testImplementation('org.springframework.boot:spring-boot-starter-test')
```
配置项 - socket server 监听端口
> application.propertie
```
printerSocketPort=10000
```
部分源码, 全部源码请查看 server/java/*
> PrintService.java
```
public class PrintService implements InitializingBean {

    @Autowired
    CacheManager cacheManager;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Value("${printerSocketPort}")
    private Integer printerSocketPort;

    SocketServer socketServer;

    @Override
    public void afterPropertiesSet() {

        Runnable myRunnable = () -> {
            socketServer = new SocketServer(cacheManager);
            socketServer.startSocketServer(printerSocketPort);
        };

        Thread thread = new Thread(myRunnable);
        thread.start();

    }

    ...

    /**
     * 调用打印机
     *
     * @return 10 - 打印机不在线
     * 1 - 成功
     * 0 - 失败
     */
    public String print() {

         try {

            String orderId = new Random(100000000).nextInt() + "";

            String printId = "001";

            SocketChannel socketChannel = socketServer.getOnlineMap().get("lssd");

            if (socketChannel != null) {

                JSONObject jsonObject = new JSONObject();
                JSONObject content = new JSONObject();
                JSONArray list = JSONArray.parseArray("[\"冬菇炖大鹅" + orderId + "\",\"烧鸭炖\"" + orderId + "\"鸡子\"]");

                jsonObject.putIfAbsent("id", orderId);
                jsonObject.putIfAbsent("pid", printId);
                jsonObject.putIfAbsent("time", sdf2.format(new Date()));
                jsonObject.putIfAbsent("from", "remoteServer");
                content.putIfAbsent("title", "title");
                content.putIfAbsent("desk", "desk");
                content.putIfAbsent("deskNum", "deskNum");
                content.putIfAbsent("list", list);
                jsonObject.putIfAbsent("content", content);

                String responseMsg = "print2::" + jsonObject.toJSONString();

                sendToClient(socketChannel, responseMsg);
            } else {
                return "10";
            }

        } catch (UnsupportedEncodingException e) {
            e.printStackTrace();
            return "0";
        } catch (IOException e) {
            e.printStackTrace();
            return "0";
        }
        return "1";
    }
    ...
```

选择使用 InitializingBean 接口, 让 spring 帮我们注入 ehcache 、jdbcTemplate 等

print() 返回值
- 10 打印机不在线
- 1 发送成功
- 0 发送失败

> SocketServer.java
```
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.ByteBuffer;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.nio.charset.Charset;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * nio socket服务端
 */
@Slf4j
@Component
public class SocketServer {

    CacheManager cacheManager;

    SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS");

    public Map<String, SocketChannel> getOnlineMap() {
        return onlineMap;
    }

    Map<String, SocketChannel> onlineMap = new HashMap<String, SocketChannel>();

    // 解码buffer
    private Charset cs = Charset.forName("UTF-8");
    // 接受数据缓冲区
    private static ByteBuffer sBuffer = ByteBuffer.allocate(1024);
    // 发送数据缓冲区
    private static ByteBuffer rBuffer = ByteBuffer.allocate(1024);
    // 选择器（叫监听器更准确些吧应该）
    private static Selector selector;

    public SocketServer(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    /**
     * 启动socket服务，开启监听
     *
     * @param port
     * @throws IOException
     */
    public void startSocketServer(int port) {
        try {
            ServerSocketChannel serverSocketChannel = ServerSocketChannel.open();
            serverSocketChannel.configureBlocking(false);
            ServerSocket serverSocket = serverSocketChannel.socket();

            serverSocket.bind(new InetSocketAddress(port));

            selector = Selector.open();

            serverSocketChannel.register(selector, SelectionKey.OP_ACCEPT);

            while (true) {
                selector.select();// select方法会一直阻塞直到有相关事件发生或超时
                Set<SelectionKey> selectionKeys = selector.selectedKeys();// 监听到的事件
                for (SelectionKey key : selectionKeys) {
                    handle(key);
                }
                selectionKeys.clear();// 清除处理过的事件
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

    }

    private void handle(SelectionKey selectionKey) throws IOException {
        try {
            ServerSocketChannel serverSocketChannel = null;
            SocketChannel socketChannel = null;
            String requestMsg = "";
            int count = 0;
            if (selectionKey.isAcceptable()) {
                // 每有客户端连接，即注册通信信道为可读
                serverSocketChannel = (ServerSocketChannel) selectionKey.channel();
                SocketChannel accept = serverSocketChannel.accept();
                System.out.println(accept.getRemoteAddress() + "  in ..");

                onlineMap.put("lssd", accept);

                socketChannel = accept;
                socketChannel.configureBlocking(false);
                socketChannel.register(selector, SelectionKey.OP_READ);

            } else if (selectionKey.isReadable()) {

                socketChannel = (SocketChannel) selectionKey.channel();
                //socketChannel.register(selector, SelectionKey.OP_WRITE);
                rBuffer.clear();

                count = socketChannel.read(rBuffer);

                // 读取数据
                if (count > 0) {
                    rBuffer.flip();
                    requestMsg = String.valueOf(cs.decode(rBuffer).array());
                }

                String responseMsg = handleMsg(requestMsg, selectionKey);

                if (responseMsg == null)
                    responseMsg = "ok";

                // 返回数据
                sBuffer = ByteBuffer.allocate(responseMsg.getBytes("UTF-8").length);
                sBuffer.put(responseMsg.getBytes("UTF-8"));
                sBuffer.flip();
                socketChannel.write(sBuffer);
//				socketChannel.close();
            }
        } catch (Exception e) {
            SocketChannel socketChannel = (SocketChannel) selectionKey.channel();
            socketChannel.close();
            e.printStackTrace();
        }
    }

    private String handleMsg(String content, SelectionKey selectionKey) {
        try {

            if ("TIME".equals(content)) {
                SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyyMMddHHmmss");
                return simpleDateFormat.format(new Date());
            }

        } catch (Exception e) {
            log.debug("数据解析异常", e.getMessage());
        }

        return null;
    }




}
```