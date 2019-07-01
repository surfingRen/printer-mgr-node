import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.maichu8.lssd.socket.SocketServer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.nio.ByteBuffer;
import java.nio.channels.SocketChannel;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Random;

@Slf4j
@Service
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

        log.debug("afterPropertiesSet .");

        Runnable myRunnable = () -> {
            log.debug("SocketServer running start");
            socketServer = new SocketServer(cacheManager);
            socketServer.startSocketServer(printerSocketPort);
            log.debug("SocketServer running on: {}", socketServer);
        };

        Thread thread = new Thread(myRunnable);
        log.debug("afterPropertiesSet . .");
        thread.start();
        log.debug("afterPropertiesSet . . .");

    }

    protected SimpleDateFormat sdf2 = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

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

    private void sendToClient(SocketChannel socketChannel, String responseMsg) throws IOException {
        ByteBuffer sBuffer = ByteBuffer.allocate(responseMsg.getBytes("UTF-8").length);
        sBuffer.put(responseMsg.getBytes("UTF-8"));
        sBuffer.flip();
        socketChannel.write(sBuffer);
    }

    public String getPrintResult(Long orderId) {
        try {

            SocketChannel socketChannel = socketServer.getOnlineMap().get("lssd");

            if (socketChannel != null) {
                String responseMsg = "print2::" + orderId;
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
}