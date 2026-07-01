package com.yiring.zjtq.service.job.impl;

import com.alibaba.fastjson.JSONObject;
import com.yiring.zjtq.config.FileComparator;
import com.yiring.zjtq.constant.JobDataKey;
import com.yiring.zjtq.constant.NumericalColor;
import com.yiring.zjtq.core.Redis;
import com.yiring.zjtq.domain.Job;
import com.yiring.zjtq.service.job.GridFileDownloadService;
import com.yiring.zjtq.util.*;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.net.ftp.FTPFile;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.*;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 智能网格下载
 *
 * @author zhangshuai
 * @date 2018/9/11 9:47
 */
@Service
@Slf4j
//@Transactional(rollbackFor = Exception.class)
public class GridFileDownloadServiceImpl implements GridFileDownloadService {

    @Autowired
    Redis redis;

    /**
     * 格点下载记录key名
     */
    private static final String DOWNLOAD_RECORD_KEY = "com.yiring.zjtq.grid.download.record";

    /**
     * Redis保存key名(湖南省格点数据)
     */
    public static final String SAVE_KEY_NAME_BECS = "com.yiring.zjtq.gridForecast.becs";
    /**
     * Redis按照预报时间来分别保存每个类型
     */
    public static final String SAVE_DATA_BY_TIME_BY = "com.yiring.zjtq.gridForecast.timeData.";

    /**
     * 本地保存路径
     */
    public static final String JSPATH =
            JobDataKey.PREFIX + File.separator + "gridFile" + File.separator;

    /**
     * X轴网格数量
     */
    public static final int GRID_NUMBER_X = 116;

    /**
     * Y轴网格数量
     */
    public static final int GRID_NUMBER_Y = 116;

    public static final double MAX_VALUE = 9000.0;


    @Override
    public void run(JobExecutionContext context) {
        JobDataMap jobDataMap = context.getJobDetail().getJobDataMap();
        Job job = Job.run(context, log);

        /**
         * 智能网格采集文件的参数相关内容 (key:参数名，value：总时效时效间隔, wgrib2解析参数, 色标文件名)
         * ERHI	最小相对湿度
         * HZ	霾
         * ERH	相对湿度
         * ECT	总云量
         * SMG	雷暴大风
         * RAT	短时强降水
         * VIS	能见度
         * SAND	沙尘暴
         * ERHA	最大相对湿度
         * HAIL	冰雹
         * SSM	雷暴
         * FOG	雾
         * PPH	降水相态
         * TMAX	最高温
         * TMIN	最低温
         * ER03	降水
         * TMP	温度
         * EDA10 地面风分量
         */
        Map<String, String> gridFileParamMap = new HashMap<>();
        gridFileParamMap.put("ER03", ",24003,rainHN3");
//        gridFileParamMap.put("ER06", ",24006,rainHN3");
//        gridFileParamMap.put("ER12", ",24012,rainHN3");
//        gridFileParamMap.put("ER24", ",24024,rainHN3");
        gridFileParamMap.put("TMP", ",24003,tem_20180109");
        gridFileParamMap.put("TMAX", ",24024,tem_20180109");
        gridFileParamMap.put("TMIN", ",24024,tem_20180109");
        gridFileParamMap.put("EDA10", ",24003,wind_20180109");
        gridFileParamMap.put("ERH", ",24003,rhu_20180109");
        gridFileParamMap.put("ERHA", ",24024,rhu_20180109");
        gridFileParamMap.put("ERHI", ",24024,rhu_20180109");
        gridFileParamMap.put("ECT", ",24003,tcc_20180109");
        gridFileParamMap.put("PPH", ",24003,PPH_20190109");
        gridFileParamMap.put("HZ", ",07203,PPH_20190109");
        gridFileParamMap.put("FOG", ",07203,PPH_20190109");
        try {
            execute(jobDataMap, gridFileParamMap);
            job.success();
        } catch (Exception e) {
            log.info(e.getMessage(), e);
            job.failure(e);
        } finally {
            job.complete();
        }

    }

    public void execute(JobDataMap dataMap, Map<String, String> gridFileParamMap) throws IOException {
        //10.111.101.211 ftpguest ftpguest
        String ftpHost = dataMap.getString("ftpHost");
        Integer ftpPort = dataMap.getInt("ftpPort");
        String ftpUsername = dataMap.getString("ftpUsername");
        String ftpPassword = dataMap.getString("ftpPassword");

        FTPClient ftpClient = new FTPClient(ftpHost, Integer.valueOf(ftpPort), ftpUsername, ftpPassword);
        String localPath = "D:/zjtq/temp";
        String lastRecord = redis.getString(DOWNLOAD_RECORD_KEY);
        long recordTimestamp = null == lastRecord ? 0 : Long.parseLong(lastRecord);
        long timestamp = 0;

        Map<Object, Object> saveDataObject = redis.hmget(SAVE_KEY_NAME_BECS);
        if (saveDataObject == null) {
            saveDataObject = new HashMap<>();
        }
        Map<String, String> saveData = new HashMap<>();
        saveDataObject.forEach((k, v) -> saveData.put(String.valueOf(k), String.valueOf(v)));

        List<FTPFile> ftpFileList = ftpClient.findNewFileList("/upload/", null);
        // 2022-10-19 ftp 新增了help.chm文件  需要剔除
        ftpFileList = ftpFileList.stream().filter(ftpFile -> !"help.chm".equals(ftpFile.getName())).collect(Collectors.toList());
        List<String> params = gridFileParamMap.keySet().stream().collect(Collectors.toList());
        for (FTPFile file : ftpFileList) {
            String param = checkParameterName(file.getName());
            params.remove(param);
        }
        //如果新的文件类型不全
        if (params.size() > 0) {
            return;
        }

        FTPFile ftpFile;
        Map<String, JSONObject> redisParamDataMap = new HashMap<>();
        for (int j = 0; j < ftpFileList.size(); j++) {

            ftpFile = ftpFileList.get(j);
            String fileName = ftpFile.getName();
            String param = checkParameterName(fileName);
            // FTP文件编辑时间
            long fileTimestamp = ftpFile.getTimestamp().getTimeInMillis();
            if (gridFileParamMap.containsKey(param) && fileTimestamp > recordTimestamp
                    && fileName.endsWith(".GRB2")) {
                String fileDateHour = fileName
                        .substring(fileName.indexOf(".") - 5, fileName.indexOf("."));
                if (gridFileParamMap.get(param).split(",")[1].equals(fileDateHour)) {
                    // FTP文件大小
                    long remoteSize = ftpFile.getSize();
                    String directory = "BECS";
                    String fileDiretory =
                            localPath + File.separator + directory + File.separator;
                    if (!new File(fileDiretory).exists()) {
                        new File(fileDiretory).mkdirs();
                    }
                    //本地保存路径
                    String localFilePath = fileDiretory + fileName;
                    boolean downloadSuccess = ftpClient
                            .download(ftpFile.getLink() + fileName, localFilePath);
                    if (downloadSuccess) {
                        File file = new File(localFilePath);
                        long localSize = file.length();
                        // 验证文件大小，以确认下载完整
                        if (remoteSize == localSize) {
                            log.info("Download file success...file name: ---" + fileName);
                            timestamp = Math.max(fileTimestamp, timestamp);
                            boolean deleteFlag = deleteSameKindOfFile(param,
                                    gridFileParamMap.get(param).split(",")[1],
                                    fileDiretory);
                            //开始解析本次下载文件
                            Long st = System.currentTimeMillis();
                            analyzeFile(fileName, gridFileParamMap, fileDiretory, saveData, ftpClient, redisParamDataMap);
                            System.out.println(String.format("一个文件解析时间：%d ms", (System.currentTimeMillis() - st)));
                        }
                    }
                }
            }
        }
//        // 保存数据到Redis中
        if (redisParamDataMap.size() > 0) {
            redisParamDataMap.forEach((k, v) -> redis.set(k, v));
        } else {
            log.info("未能保存最新时刻数据");
        }
        Map<String, Object> finalSaveDataObject = new HashMap<>();
        saveData.forEach((k, v) -> finalSaveDataObject.put(k, v));
        redis.hmset(SAVE_KEY_NAME_BECS, finalSaveDataObject);
        if (timestamp != 0) {
            redis.set(DOWNLOAD_RECORD_KEY, timestamp);
            //后添加删除最新数据一天前的json文件
            deleteFolder(timestamp);
        }
        ftpClient.disConnection();
    }

    /**
     * 删除最新数据一天前的json文件
     *
     * @param timestamp
     */
    private void deleteFolder(long timestamp) {
        LocalDateTime newFolderTime = LocalDateTime.ofEpochSecond(timestamp / 1000, 0, ZoneOffset.ofHours(8));
        File savePathFolder = new File(JSPATH);
        File[] folders = savePathFolder.listFiles();
        for (File folder : folders) {
            LocalDateTime oldFolderTime = LocalDateTime.parse(folder.getName() + "230000", DateTimeFormatter.ofPattern("yyMMddHHmmss"));
            Duration sub = Duration.between(newFolderTime, oldFolderTime.plusHours(36));
            if (sub.toMillis() < 0) {
                try {
                    FileUtil.delete(folder.getAbsolutePath());
                } catch (IOException e) {
                    log.error(e.getMessage(), e);
                }
            }
        }
    }

    void analyzeFile(String fileName, Map gridFileParamMap, String fileDiretory,
                     Map<String, String> saveData, FTPClient ftpClient, Map<String, JSONObject> redisParamDataMap)
            throws IOException {
        // 参数名(如ER03、EDA10等)
        String param = checkParameterName(fileName);
        // 起报时间
        String startTime = checkStartTime(fileName);
        // wgrib2解析参数(如::TMP:2 m)
        String wgrib2Param = gridFileParamMap.get(param).toString().split(",")[0];
        // 解析文件临时路径
        String tempPath = fileDiretory;
        String tempName = param + ".txt";
        String[] cmdArray = {"cmd.exe", "/c",
                "wgrib2 " + fileName + " | grep '" + wgrib2Param + "' | wgrib2 -i "
                        + fileName + " -text " + tempName};
        CommonUtils.grib2Analyze(cmdArray, tempPath, fileName);

        boolean readSuccess = readFile(tempPath + tempName, param, startTime, saveData, ftpClient, redisParamDataMap);

        log.info(readSuccess ? fileName + "GRB2文件解析成功..." : fileName + "GRB2文件解析失败...");

        new File(tempPath + tempName).delete();
    }

    private boolean readFile(String path, String param, String startTime,
                             Map<String, String> saveData, FTPClient ftpClient, Map<String, JSONObject> redisParamDataMap) {
        Map<String, Integer> becsSortMap = new HashMap<>();
        becsSortMap.put("ER03", 0);
        becsSortMap.put("TMP", 1);
        becsSortMap.put("TMAX", 2);
        becsSortMap.put("TMIN", 3);
        becsSortMap.put("ERH", 4);
        becsSortMap.put("ERHA", 5);
        becsSortMap.put("ERHI", 6);
        becsSortMap.put("ECT", 7);
        becsSortMap.put("FOG", 8);
        becsSortMap.put("PPH", 9);
        becsSortMap.put("HZ", 10);
        becsSortMap.put("EDA10", 11);

        //按时间保存数据
        Map<String, Object> saveDataByTime = new HashMap<>();
        //额外保存的降水24小时累加数据
        Map<String, Object> savePreDataByTime = new HashMap<>();

        File file = new File(path);
        BufferedReader reader = null;
        int index = becsSortMap.get(param);

        //降水
        boolean isPre = "ER03".equals(param);
        //气温
        boolean isTmp = "TMAX".equals(param) || "TMIN".equals(param) || "TMP".equals(param);
        //风场
        boolean isEda = "EDA10".equals(param);
        //云量
        boolean isEct = "ECT".equals(param);
        //湿度
        boolean isErh = "ERHA".equals(param) || "ERHI".equals(param) || "ERH".equals(param);
        //降水相态
        boolean isPph = "PPH".equals(param);
        //雾
        boolean isFog = "FOG".equals(param);
        //霾
        boolean isHz = "HZ".equals(param);

        //时间间隔为24小时的类型(其他为间隔3小时)
        boolean is24 =
                "TMAX".equals(param) || "TMIN".equals(param) || "ERHA".equals(param) || "ERHI"
                        .equals(param);

        //保存路径
        String savePath =
                JSPATH + startTime.substring(0, 6) + File.separator + startTime.substring(6, 8)
                        + File.separator;
        File checkOldFile = new File(savePath);
        if (!checkOldFile.exists()) {
            checkOldFile.mkdirs();
        }
        boolean isAllZero = true;
        double[][] edaData = null;
        if (file.exists()) {

            //格点二维数组
            double[][] gridStrings = new double[GRID_NUMBER_X][GRID_NUMBER_Y];
            double[][] gridUStrings = new double[GRID_NUMBER_X][GRID_NUMBER_Y];
            double[][] gridVStrings = new double[GRID_NUMBER_X][GRID_NUMBER_Y];

            try {
                reader = new BufferedReader(new FileReader(file));
                // 文件行数据、格点编码
                String lineStr, gridCode;
                // 总行数、总列数、格点所在行数、格点所在列数、格点行数计数、格点统计次数
                int rowCount = 0, colCount = 0, rowNum = 0, colNum = 0, lineNum = 0, gridTimes = 0;
                //一维数组个数 每行个数 列数 循环保存次数
                int oneTimeNum = 0, gridRowNum = 0, gridColNum = 0, saveNum = 0;
                //一行的格子数据
                double[] oneTimeData = new double[GRID_NUMBER_X];

                //一次风场U数值的一维数组
                double[] oneUData = new double[GRID_NUMBER_X];
                //一次风场V数值的一维数组
                double[] oneVData = new double[GRID_NUMBER_X];

                //一次24小时累计降水的二维数组
                double[][] onePreData = new double[GRID_NUMBER_X][GRID_NUMBER_Y];
                int preNum = 0;

                LocalDateTime startDateTime = LocalDateTime.parse("20" + startTime + "0000",
                        DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));

                //临时记录风场保存次数
                long windSaveCount = 0;
                boolean islast = false;
                while (true) {
                    if (null == (lineStr = reader.readLine())) {
                        islast = true;
                    }
                    if (islast || lineStr.split("\\s+").length == 2) {
                        //当读到116 116时处理
                        if (!islast) {
                            //不是最后一行时
                            colCount = Integer.valueOf(lineStr.split("\\s+")[0]);
                            rowCount = Integer.valueOf(lineStr.split("\\s+")[1]);
                        }
                        if (isEda && null == edaData) {
                            edaData = new double[colCount * rowCount][80 * 2];
                        }
                        lineNum = 0;
                        rowNum = 0;
                        colNum = 0;

                        // 画非风场Geojson和色斑图，并记录路径
                        if (saveNum > 0 && !isEda) {
                            startDateTime = startDateTime.plusHours(is24 ? 24 : 3);
                            String saveTime = startDateTime
                                    .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                            //不同类型复制色标文件
                            NumericalColor.Interval interval = null;
                            if (isTmp) {
                                interval = NumericalColor.TEM;
                            } else if (isPre) {
                                //3小时降水量色斑图色标值
                                interval = NumericalColor.ER03;
                                //累加降水量
                                for (int x = 0; x < GRID_NUMBER_X; x++) {
                                    for (int y = 0; y < GRID_NUMBER_Y; y++) {
                                        onePreData[x][y] = MathUtil.add(gridStrings[x][y], onePreData[x][y]);
                                    }
                                }
                                if (preNum == 7) {
                                    JSONObject pathJson = new JSONObject();
                                    NumericalColor.Interval pre24Interval = NumericalColor.ER24;

                                    //添加过滤数组。在GeoUtils.isoLines方法执行后，onePreData数组会乱码
                                    double[][] refineData = new double[onePreData.length][];
                                    getRefineData(onePreData, refineData);

                                    //每8次记录一次24小时累计降水色斑图文件
                                    String savejson = GeoUtils.isoLines(onePreData, pre24Interval, false);
                                    boolean isMax = false;
                                    for (int i = 0; i < onePreData.length; i++) {
                                        double[] onePreDatum = onePreData[i];
                                        for (int j = 0; j < onePreDatum.length; j++) {
                                            double value = onePreDatum[j];
                                            if (value > 9000) {
                                                isMax = true;
                                                break;
                                            }
                                        }
                                        if (isMax) {
                                            break;
                                        }
                                    }
                                    if (isMax) {
                                        savejson = GeoUtils.emptyJSON().toJSONString();
                                    }
                                    //调整格点数值
                                    for (int i = 0; i < refineData.length; i++) {
                                        double[] values = refineData[i];
                                        for (int j = 0; j < values.length; j++) {
                                            String value = String.valueOf(values[j]);
                                            String gridCodeTemp = CommonUtils.gridEncoded(j + 1, i + 1);
                                            takeData(gridCodeTemp, index, value, gridTimes, isTmp ? false : false, startTime, isEct,
                                                    becsSortMap, saveData, true);
                                        }
                                    }

                                    //每8次记录一次24小时累计降水geoJson文件
                                    //使用自定义json返回判断格点文件数据是否有问题
                                    JSONObject savePrePointjson = GeoUtils.toJSONCustomize(refineData, 0.05, pre24Interval);
                                    String savePointJSPath = savePath + "ER24Point" + startDateTime
                                            .format(DateTimeFormatter.ofPattern("yyyyMMddHH")) + ".json";
                                    boolean savePointFlag = saveJSFile(savePointJSPath, savePrePointjson.toJSONString(), ftpClient);
                                    if (savePointFlag) {
                                        pathJson.put("pointPath", savePointJSPath);
                                    } else {
                                        pathJson.put("pointPath", "");
                                    }

                                    //每8次记录一次24小时累计降水色斑图
                                    String saveJSPath = savePath + "ER24" + "-" + startDateTime
                                            .format(DateTimeFormatter.ofPattern("yyyyMMddHH")) + ".json";
                                    boolean saveFlag = saveJSFile(saveJSPath, savejson, ftpClient);
                                    if (saveFlag) {
                                        pathJson.put("path", saveJSPath);
                                    } else {
                                        pathJson.put("path", "");
                                    }
                                    savePreDataByTime.put(saveTime, pathJson);
                                    preNum = 0;
                                    onePreData = new double[GRID_NUMBER_X][GRID_NUMBER_Y];
                                } else {
                                    preNum++;
                                }

                            } else if (isEct) {
                                interval = NumericalColor.ECT;
                            } else if (isErh) {
                                interval = NumericalColor.ERH;
                            } else if (isPph) {
                                interval = NumericalColor.PPH;
                            } else if (isFog) {
                                interval = NumericalColor.FOG;
                            } else if (isHz) {
                                interval = NumericalColor.HZ;
                            }

                            JSONObject pathJson = new JSONObject();

                            //添加过滤数组。在GeoUtils.isoLines方法执行后，onePreData数组会乱码
                            double[][] refineData = new double[gridStrings.length][];
                            getRefineData(gridStrings, refineData);

                            //保存本时次色斑图json
                            String savejson = GeoUtils.isoLines(gridStrings, interval, false);
                            boolean isMax = false;
                            for (int i = 0; i < gridStrings.length; i++) {
                                double[] grid = gridStrings[i];
                                for (int j = 0; j < grid.length; j++) {
                                    double value = grid[j];
                                    if (value > 9000) {
                                        isMax = true;
                                        break;
                                    }
                                }
                                if (isMax) {
                                    break;
                                }
                            }
                            if (isMax) {
                                savejson = GeoUtils.emptyJSON().toJSONString();
                            }

                            //调整格点数值
                            for (int i = 0; i < refineData.length; i++) {
                                double[] values = refineData[i];
                                for (int j = 0; j < values.length; j++) {
                                    String value = String.valueOf(values[j]);
                                    //格点下标
                                    String gridCodeTemp = CommonUtils.gridEncoded(j + 1, i + 1);
                                    takeData(gridCodeTemp, index, value, gridTimes, isTmp ? false : false, startTime, isEct,
                                            becsSortMap, saveData, true);
                                }
                            }

                            //保存本时次格点GeoJson
                            JSONObject savePointjson = GeoUtils.toJSONCustomize(refineData, 0.05, interval);
                            String savePointJSPath = savePath + param + "Point" + "-" + startDateTime
                                    .format(DateTimeFormatter.ofPattern("yyyyMMddHH")) + ".json";
                            boolean savePointFlag = saveJSFile(savePointJSPath, savePointjson.toJSONString(), ftpClient);
                            if (savePointFlag) {
                                pathJson.put("pointPath", savePointJSPath);
                            } else {
                                pathJson.put("pointPath", "");
                            }

                            //保存色斑图
                            String saveJSPath = savePath + param + "-" + startDateTime.format(DateTimeFormatter.ofPattern("yyyyMMddHH")) + ".json";
                            boolean saveFlag = saveJSFile(saveJSPath, savejson, ftpClient);
                            if (saveFlag) {
                                pathJson.put("path", saveJSPath);
                            } else {
                                pathJson.put("path", "");
                            }

                            //保存本时次两个文件路径
                            saveDataByTime.put(saveTime, pathJson);

                        }

                        //风场数据色斑图Geojson处理
                        if (saveNum >= 1 && isEda) {
                            if (saveNum % 2 != 0) {
                                windSaveCount++;
                                startDateTime = startDateTime.plusHours(3);
                                String saveTime = startDateTime
                                        .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                                double[][] windSpeedGrid = new double[GRID_NUMBER_X][GRID_NUMBER_Y];
                                double[][] windDirectionGrid = new double[GRID_NUMBER_X][GRID_NUMBER_Y];
                                for (int i = 0; i < GRID_NUMBER_X; i++) {
                                    double[] gridxArray = new double[GRID_NUMBER_Y];
                                    // 风向数据
                                    double[] gridxDirectionArray = new double[GRID_NUMBER_Y];
                                    for (int j = 0; j < GRID_NUMBER_Y; j++) {
                                        double u = gridUStrings[i][j];
                                        double v = gridVStrings[i][j];
                                        double speed = getWindSpeed(u, v, 1);
                                        gridxArray[j] = speed;
                                        double direction = getWindDirection(u, v);
                                        gridxDirectionArray[j] = direction;

                                    }
                                    windSpeedGrid[i] = gridxArray;
                                    windDirectionGrid[i] = gridxDirectionArray;
                                }

                                JSONObject pathJson = new JSONObject();

                                //添加过滤数组。在GeoUtils.isoLines方法执行后，onePreData数组会乱码
                                double[][] refineData = new double[windSpeedGrid.length][];
                                getRefineData(windSpeedGrid, refineData);
                                //画色斑图
                                String savejson = GeoUtils.isoLines(windSpeedGrid, NumericalColor.EDA10, false);

                                //保存本时次格点GeoJson
                                JSONObject savePointjson = GeoUtils.toWindDJSON(refineData, windDirectionGrid, 0.05, NumericalColor.EDA10);
                                String savePointJSPath = savePath + param + "Point" + "-" + startDateTime
                                        .format(DateTimeFormatter.ofPattern("yyyyMMddHH")) + ".json";
                                boolean savePointFlag = saveJSFile(savePointJSPath, savePointjson.toJSONString(), ftpClient);
                                if (savePointFlag) {
                                    pathJson.put("pointPath", savePointJSPath);
                                } else {
                                    pathJson.put("pointPath", "");
                                }

                                String saveJSPath = savePath + param + "-" + startDateTime
                                        .format(DateTimeFormatter.ofPattern("yyyyMMddHH")) + ".json";
                                boolean saveFlag = saveJSFile(saveJSPath, savejson, ftpClient);
                                if (saveFlag) {
                                    pathJson.put("path", saveJSPath);
                                } else {
                                    pathJson.put("path", "");
                                }

                                //保存本时次两个文件路径
                                saveDataByTime.put(saveTime, pathJson);
                            }
                        }

                        saveNum++;
                        if (islast) {
                            //最后一行，，并保存文件完毕
                            break;
                        }

                        gridTimes++;
                    } else {
                        //读到数据时的处理方法
                        lineNum = lineNum + 1;
                        //增加经度
                        colNum = colNum + 1;
                        gridCode = CommonUtils.gridEncoded(rowNum + 1, colNum);
                        if (isEda) {
                            //处理风场数据
                            takeEdaData(gridCode, lineStr, edaData, colCount, gridTimes);
                            if (saveNum % 2 != 0) {
                                //u值,160个中从第一个116*116开始偶数位是U值
                                if (gridColNum <= 115) {
                                    if (gridRowNum <= 115) {
                                        oneUData[oneTimeNum] = Double.parseDouble(lineStr);
                                        gridRowNum++;
                                        oneTimeNum++;
                                    }
                                    if (gridRowNum > 115) {
                                        oneTimeNum = 0;
                                        gridRowNum = 0;
                                        gridUStrings[gridColNum] = oneUData;
                                        oneUData = new double[GRID_NUMBER_X];
                                        gridColNum++;
                                    }
                                    if (gridColNum > 115) {
                                        gridColNum = 0;
                                    }
                                }
                            }
                            if (saveNum % 2 == 0) {
                                //v值 160个中从第二个116*116开始奇数位是V值
                                if (gridColNum <= 115) {
                                    if (gridRowNum <= 115) {
                                        oneVData[oneTimeNum] = Double.parseDouble(lineStr);
                                        oneTimeNum++;
                                        gridRowNum++;
                                    }
                                    if (gridRowNum > 115) {
                                        gridRowNum = 0;
                                        oneTimeNum = 0;
                                        gridVStrings[gridColNum] = oneVData;
                                        gridColNum++;
                                        oneVData = new double[GRID_NUMBER_X];
                                    }
                                    if (gridColNum > 115) {
                                        gridColNum = 0;
                                    }
                                }
                            }
                        } else {
                            //处理非风场数据
                            takeData(gridCode, index, lineStr, gridTimes, isTmp, startTime, isEct,
                                    becsSortMap, saveData, false);
                            if (isAllZero && isPre
                                    && MathUtil.round(Double.parseDouble(lineStr), 1) != 0) {
                                isAllZero = false;
                            }
                            if (gridColNum <= 115) {
                                if (gridRowNum <= 115) {
                                    Double val = isTmp && Double.parseDouble(lineStr) < 9000 ? MathUtil
                                            .round(Double.parseDouble(lineStr) - 273.15, 1)
                                            : Double.parseDouble(lineStr);
                                    oneTimeData[oneTimeNum] = Double.valueOf(val);
                                    oneTimeNum++;
                                    gridRowNum++;
                                }
                                if (gridRowNum > 115) {
                                    gridRowNum = 0;
                                    oneTimeNum = 0;
                                    gridStrings[gridColNum] = oneTimeData;
                                    gridColNum++;
                                    oneTimeData = new double[GRID_NUMBER_X];
                                }
                                if (gridColNum > 115) {
                                    gridColNum = 0;
                                }
                            }
                        }
                        if (lineNum % colCount == 0) {
                            //增加纬度
                            rowNum++;
                            //把经度归零
                            colNum = 0;
                        }
                    }
                }

                // 风场数据，根据U、V风计算风向和风速
                if (isEda) {
                    getWindSAndWindD(edaData, colCount, startTime, index, becsSortMap, saveData);
                }
            } catch (Exception e) {
                log.error(e.getMessage(), e);
                log.error("Read file faild.The param is " + param + ",and the start time is "
                        + startTime);
                return false;
            } finally {
                try {
                    if (null != reader) {
                        reader.close();
                    }
                } catch (IOException e) {
                    log.error(e.getMessage(), e);
                }
            }

            //保存数据
            /**文件时间*/
            LocalDateTime startFileTime = LocalDateTime.parse("20" + startTime + "0000", DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));

            JSONObject data = new JSONObject();
            saveDataByTime.forEach((k, v) -> {
                data.put(k, v);
            });
            JSONObject saveRedisData = new JSONObject();
            saveRedisData.put("data", data);
            saveRedisData.put("startTime", startFileTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            redisParamDataMap.put(SAVE_DATA_BY_TIME_BY + param, saveRedisData);

            if (savePreDataByTime.size() > 0) {
                //额外保存一份降水24小时累加数据
                JSONObject preData = new JSONObject();
                savePreDataByTime.forEach((k, v) -> {
                    preData.put(k, v);
                });
                saveRedisData = new JSONObject();
                saveRedisData.put("data", preData);
                saveRedisData.put("startTime", startFileTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
                redisParamDataMap.put(SAVE_DATA_BY_TIME_BY + "ER24", saveRedisData);
            }
        } else {
            log.info("文件解析失败，不存在文件 " + file.getName());
        }
        return true;
    }

    /**
     * 保存一份原始的二维数据
     *
     * @param onePreData 原始数组
     * @param refineData 过滤数组
     */
    private void getRefineData(double[][] onePreData, double[][] refineData) {
        for (int i = 0; i < onePreData.length; i++) {
            double[] data = onePreData[i];
            double[] points = new double[data.length];
            for (int j = 0; j < data.length; j++) {
                double value = data[j];
                value = MathUtil.round(value, 2);
                points[j] = value;
            }
            refineData[i] = points;
        }
    }

    private void getWindSAndWindD(double[][] edaData, int colCount, String startTime, int index,
                                  Map<String, Integer> becsSortMap, Map<String, String> saveData) {
        // 风速存储字符串
        StringBuffer windSBuffer;
        // 风向存储字符串
        StringBuffer windDBuffer;
        // 格点编码
        String gridCode;
        // U分量、V分量、风速、风向
        double u = 0, v = 0, ws = 0, wd = 0;
        // 保存所有格点U、V分量的数组
        double[][] windSDArr = null;
        // 保存单格点U、V分量的数组
        double[] gridUVData;
        for (int i = 0; i < edaData.length; i++) {
            if (null == windSDArr) {
                windSDArr = new double[edaData.length][];
            }
            gridUVData = edaData[i];
            windSDArr[i] = new double[gridUVData.length];
            windSBuffer = new StringBuffer();
            windDBuffer = new StringBuffer();
            // 通过下标计算格点编码
            gridCode = String.valueOf(10000 + i / colCount + 1).substring(1, 5) + String
                    .valueOf(10000 + i % colCount + 1).substring(1, 5);
            int interval = 2;
            for (int j = 0; j < gridUVData.length - 1; j += interval) {
                u = gridUVData[j];
                v = gridUVData[j + 1];
                ws = getWindSpeed(u, v, 1);
                windSBuffer.append(ws);
                windSDArr[i][j] = ws;
                wd = getWindDirection(u, v);
                windDBuffer.append(wd);
                windSDArr[i][j + 1] = wd;
                if (j != gridUVData.length - 2) {
                    windSBuffer.append(",");
                    windDBuffer.append(",");
                }
            }
            // Redis保存数据
            saveWindData(gridCode, windSBuffer.toString(), windDBuffer.toString(), startTime, index,
                    becsSortMap, saveData);
        }
    }

    /**
     * 记录单格点00010001开始数据
     *
     * @param gridCode    格点编码
     * @param index       数据保存在数组中的下标
     * @param value       值
     * @param gridTimes   单个格点被读的次数
     * @param isTmp       参数是否与温度相关
     * @param startTime   起始时间
     * @param isEct       是否是云量
     * @param becsSortMap 类型MAP
     * @param saveData    保存数据
     * @param isRefine    是否为提炼过的后的格点数据
     */
    private void takeData(String gridCode, int index, String value, int gridTimes, boolean isTmp,
                          String startTime, boolean isEct, Map<String, Integer> becsSortMap,
                          Map<String, String> saveData, boolean isRefine) {

        String gridData = "";
        if (saveData.containsKey(gridCode)) {
            gridData = saveData.get(gridCode);
        }
        StringBuffer buffer = new StringBuffer();
        if (StringUtils.hasText(gridData)) {
            String[] gridDatas = gridData.split("#");
            for (int i = 0; i < gridDatas.length; i++) {
                String prevValue = gridDatas[i];
                if (i == index) {
                    // 绝对温度转换成摄氏温度
                    if (gridTimes == 1) {
                        buffer.append((index == 0 ? "" : "#") + startTime + ":");
                    } else {
                        if (isRefine) {
                            //把未提炼的数据删除，加入已提炼过的
                            prevValue = prevValue.substring(0, prevValue.lastIndexOf(","));
                        }
                        buffer.append((index == 0 ? "" : "#") + prevValue + ",");
                    }
                    if (isTmp && Double.parseDouble(value) < 500) {
                        // 排除温度的无效值(500以上)
                        buffer.append(MathUtil.round(Double.parseDouble(value) - 273.15, 1));
                    } else if (isEct && Double.parseDouble(value) > 100) {
                        // 云量100以上按100保存
                        buffer.append(100);
                    } else {
                        // 所有值都保留一位小数
                        buffer.append(MathUtil.round(Double.parseDouble(value), 1));
                    }
                } else {
                    buffer.append(i == 0 ? gridDatas[i] : "#" + gridDatas[i]);
                }
            }
        } else {
            int size = becsSortMap.size();
            for (int i = 0; i < size; i++) {
                if (i == index) {
                    buffer.append("#" + startTime + ":" + (isTmp && Double.parseDouble(value) < 500
                            ? MathUtil.round(Double.parseDouble(value) - 273.15, 1) : value));
                } else if (i == 0) {
                    buffer.append(" ");
                } else {
                    buffer.append("# ");
                }
            }
        }
        saveData.put(gridCode, buffer.toString());

    }

    /**
     * 记录风场U、V分量值
     */
    private void takeEdaData(String gridCode, String value, double[][] edaData, int colCount,
                             int index) {
        int lineNum = Integer.valueOf(gridCode.substring(0, 4)) - 1;
        int colNum = Integer.valueOf(gridCode.substring(4)) - 1;
        edaData[lineNum * colCount + colNum][index - 1] = MathUtil
                .round(Double.parseDouble(value), 1);
    }

    /**
     * 计算风速
     *
     * @param u     U分量
     * @param v     V分量
     * @param scale 保留小数的位数
     */
    public static final double getWindSpeed(double u, double v, int scale) {
        return MathUtil.round(Math.sqrt(Math.pow(u, 2) + Math.pow(v, 2)), scale);
    }

    /**
     * 计算风向
     *
     * @param u U分量
     * @param v V分量
     */
    public static final int getWindDirection(double u, double v) {
        double tan = Math.abs(v) / Math.abs(u);
        double angle = Math.toDegrees(Math.atan(tan));
        if (u >= 0 && v >= 0) {
            return (int) Math.round(angle);
        } else if (u >= 0 && v < 0) {
            return (int) Math.round(90 + angle);
        } else if (u < 0 && v >= 0) {
            return (int) Math.round(270 + angle);
        } else if (u < 0 && v < 0) {
            return (int) Math.round(180 + angle);
        }
        return 0;
    }

    /**
     * 保存风场数据
     *
     * @param saveData  保存数据集合
     * @param gridCode  格点编码
     * @param windSpeed 风速
     * @param windDrct  风向
     * @param startTime 起报时间(MMdd)
     * @param index     下标
     */
    private void saveWindData(String gridCode, String windSpeed, String windDrct, String startTime,
                              int index, Map<String, Integer> becsSortMap, Map<String, String> saveData) {
        String data = saveData.get(gridCode);
        String windStr = startTime + ":" + windSpeed + "#" + startTime + ":" + windDrct;
        StringBuffer buffer;
        if (StringUtils.hasText(data)) {
            String[] array = data.split("#");
            buffer = new StringBuffer();
            for (int i = 0; i < array.length; i++) {
                if (i < index) {
                    buffer.append((i == 0 ? "" : "#") + array[i]);
                } else {
                    buffer.append((i == 0 ? "" : "#") + windStr);
                    break;
                }
            }
        } else {
            int size = becsSortMap.size();
            buffer = new StringBuffer();
            for (int i = 0; i < size; i++) {
                if (i < index) {
                    buffer.append(" #");
                } else {
                    buffer.append(windStr);
                }
            }
        }
        saveData.put(gridCode, buffer.toString());
    }

    /**
     * 获取文件名中的参数部分
     */
    private String checkParameterName(String fileName) {
        String[] fileNameParts = fileName.split("-");
        String paramPart = fileNameParts[1];
        String[] paramParts = paramPart.split("_");
        return paramParts[0];
    }

    /**
     * 获取文件名中的起报时间部分
     *
     * @param fileName 文件名:【*.GRB2】
     */
    private static String checkStartTime(String fileName) {
        String startTime = "";
        String reg = "_\\d{12}_";
        Matcher matcher = Pattern.compile(reg).matcher(fileName);
        while (matcher.find()) {
            startTime = matcher.group(0);
        }
        return startTime.substring(3, 11);
    }

    /**
     * 删除相同类型的过期文件
     */
    public boolean deleteSameKindOfFile(String param, String dateHour, String fileDiretory) {
        boolean deleteFlag = false;
        File file = new File(fileDiretory);
        List<File> fileList = new ArrayList<>();
        if (file.exists() && file.isDirectory()) {
            File[] files = file.listFiles();
            for (int i = 0; i < files.length; i++) {
                File f = files[i];
                String fileName = f.getName();
                if (fileName.contains(param) && fileName.contains(dateHour)) {
                    fileList.add(f);
                }
            }
        }
        Collections.sort(fileList, new FileComparator());
        for (int i = 0; i < fileList.size(); i++) {
            if (i != fileList.size() - 1) {
                deleteFlag = fileList.get(i).delete();
                log.info("Delete overtime file,file name: ------" + fileList.get(i).getName());
            }
        }
        return deleteFlag;
    }

    /**
     * 保存js文件
     *
     * @param savePath 盘符开始的全路径
     * @param content  保存内容
     */
    private boolean saveJSFile(String savePath, String content, FTPClient client) {
        try {
            //打开一个写文件器，构造函数中的第二个参数true表示以追加形式写文件
            if (!new File(savePath).exists()) {
                new File(savePath).createNewFile();
            }
            FileWriter writer = new FileWriter(savePath);
            writer.write(content);
            writer.close();
            client.heartbeat();
        } catch (IOException e) {
            log.info(e.getMessage(), e);
        }
        return true;
    }

}
