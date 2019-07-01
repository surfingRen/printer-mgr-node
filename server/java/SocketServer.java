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