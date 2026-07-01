/* (C) 2022 YiRing, Inc. */
package com.yiring.common.util.contour;

import cn.hutool.core.codec.Base64;
import cn.hutool.core.io.FileUtil;
import cn.hutool.core.io.IoUtil;
import cn.hutool.core.util.NumberUtil;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.yiring.common.constant.DataDisposeConstant;
import com.yiring.common.util.map.GeoTools;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import javax.imageio.ImageIO;
import lombok.experimental.UtilityClass;
import lombok.extern.slf4j.Slf4j;
import wcontour.Contour;
import wcontour.Interpolate;
import wcontour.global.Border;
import wcontour.global.PointD;
import wcontour.global.PolyLine;
import wcontour.global.Polygon;

/**
 * Contour Util
 *
 * @author Jim
 * @version 0.1
 * 2022/1/5 14:57
 */

@Slf4j
@UtilityClass
public class ContourUtil {

    /**
     * 最小经度 108.65
     */
    public static final double MIN_LNG = 108.6;
    /**
     * 最小纬度
     */
    public static final double MIN_LAT = 24.5D;
    /**
     * 最大经度
     */
    public static final double MAX_LNG = 114.4D;
    /**
     * 最大纬度  114.4
     */
    public static final double MAX_LAT = 30.3D;
    /**
     * 网格格距
     */
    public static final double GRID_DISTANCE = 0.05D;
    /**
     * X轴网格数量
     */
    public static final int GRID_NUMBER_X = 59;
    /**
     * Y轴网格数量
     */
    public static final int GRID_NUMBER_Y = 59;

    /**
     * 未定义的数值
     */
    public static final double UNDEFINED_DATA = -9999D;

    public String getRangeColor(InterpolateColor.Interval interval, double lv) {
        int n = -1;
        for (int i = interval.getValues().length - 1; i >= 0; i--) {
            if (interval.getValues()[i] <= lv) {
                n = i;
                break;
            }
        }
        return interval.getColors()[n + 1];
    }

    public static JSONObject isoLines(
        double[][] trainData,
        int xNUm,
        int yNum,
        double minLon,
        double minLat,
        double maxLon,
        double maxLat,
        InterpolateColor.Interval interval,
        boolean interpolate,
        boolean isLine
    ) {
        double[] xs = new double[interpolate ? xNUm : trainData[0].length];
        double[] ys = new double[interpolate ? yNum : trainData.length];
        Interpolate.createGridXY_Num(minLon, minLat, maxLon, maxLat, xs, ys);
        double[][] gridData = interpolate
            ? Interpolate.interpolation_IDW_Neighbor(trainData, xs, ys, 4, UNDEFINED_DATA)
            : trainData;

        int[][] temp = new int[gridData.length][gridData[0].length];
        List<Border> borders = Contour.tracingBorders(gridData, xs, ys, temp, UNDEFINED_DATA);

        double[] dataInterval = interval.getValues();
        List<PolyLine> polyLines = Contour.smoothLines(
            Contour.tracingContourLines(
                gridData,
                xs,
                ys,
                dataInterval.length,
                dataInterval,
                UNDEFINED_DATA,
                borders,
                temp
            )
        );
        List<Polygon> polygons = Contour.tracingPolygons(gridData, polyLines, borders, dataInterval);

        JSONObject json;
        if (isLine) {
            json = toPolyLineJson(polyLines, null, null, interval);
        } else {
            json = toPolygonJson(polygons, null, null, interval);
        }

        return json;
    }

    /**
     * 画湖南区域色斑图 固定经纬度范围
     *
     * @param xs
     * @param ys
     * @param values
     * @param interval
     * @param type
     * @return
     */
    public JSONObject isHnCrop(
        double[] xs,
        double[] ys,
        double[] values,
        InterpolateColor.Interval interval,
        ContourOutType type
    ) {
        InterpolateAlgorithm algorithm = InterpolateAlgorithm.IDW_NEIGHBOR;
        return toJSON(
            xs,
            ys,
            values,
            null,
            null,
            MIN_LNG,
            MAX_LNG,
            MIN_LAT,
            MAX_LAT,
            GRID_NUMBER_X,
            GRID_NUMBER_Y,
            UNDEFINED_DATA,
            algorithm,
            interval,
            type,
            null
        );
    }

    public double[][] processDiscreteValues(double[] xs, double[] ys, double[] values, double[] intervalValues) {
        double[][] discreteData = new double[xs.length][3];
        for (int i = 0; i < xs.length; i++) {
            discreteData[i][0] = xs[i];
            discreteData[i][1] = ys[i];
            //            discreteData[i][2] = values[i];
            if (values[i] < intervalValues[0]) {
                discreteData[i][2] = intervalValues[0] - 1;
                continue;
            }
            if (values[i] >= intervalValues[intervalValues.length - 1]) {
                discreteData[i][2] = 1.5 * intervalValues[intervalValues.length - 1];
                continue;
            }
            for (int j = 0; j < intervalValues.length - 1; j++) {
                if (values[i] >= intervalValues[j] && values[i] < intervalValues[j + 1]) {
                    //                 //  0.5 * (intervalValues[j] + intervalValues[j + 1])
                    discreteData[i][2] = intervalValues[j] + ((intervalValues[j + 1] - intervalValues[j]) * 0.75);
                    break;
                }
            }
        }

        return discreteData;
    }

    /**
     * 将网格数据输出为标准的GeoJSON
     *
     * @param gridData  数据数组
     * @param xMin      最小经度
     * @param yMin      最小纬度
     * @param xDistance 经度间隔
     * @param yDistance 纬度间隔
     * @param interval  颜色范围
     * @return geoJson
     */
    public static JSONObject toJSONCustomize(
        double[][] gridData,
        double xMin,
        double yMin,
        int xDistance,
        int yDistance,
        InterpolateColor.Interval interval
    ) {
        return toJSONCustomize(gridData, null, xMin, yMin, xDistance, yDistance, interval);
    }

    /**
     * 将网格数据输出为标准的GeoJSON 包含风场风向
     *
     * @param gridData          数据值数组
     * @param windDirectionDate 风向数组
     * @param xMin              最小经度
     * @param yMin              最小纬度
     * @param xDistance         经度间隔
     * @param yDistance         纬度间隔
     * @param interval          颜色范围
     * @return geoJson
     */
    public static JSONObject toJSONCustomize(
        double[][] gridData,
        double[][] windDirectionDate,
        double xMin,
        double yMin,
        double xDistance,
        double yDistance,
        InterpolateColor.Interval interval
    ) {
        JSONObject geoJSON = new JSONObject();
        geoJSON.put("type", "FeatureCollection");
        JSONArray features = new JSONArray();
        for (int i = 0; i < gridData.length; i++) {
            double[] grids = gridData[i];
            for (int j = 0; j < grids.length; j++) {
                double[] lngLat = new double[] {
                    NumberUtil.add(NumberUtil.mul(xDistance, j), xMin),
                    NumberUtil.add(yMin, NumberUtil.mul(yDistance, i)),
                };
                int len1 = String.valueOf(lngLat[0]).length();
                int len2 = String.valueOf(lngLat[1]).length();
                if (len1 > 6 || len2 > 6) {
                    log.info("{} {} ", lngLat[0], lngLat[1]);
                }

                double value = NumberUtil.round(grids[j], 6).doubleValue();
                String color = interval.getColors()[indexOfRangeArray(interval.getValues(), value)];
                String valueStr = String.valueOf(value);
                if (value > 9000) {
                    valueStr = String.valueOf(DataDisposeConstant.INVALID_VALUE);
                    color = "#ffffff";
                }
                JSONObject properties = new JSONObject().fluentPut("val", valueStr).fluentPut("color", color);
                if (Objects.nonNull(windDirectionDate)) {
                    double windDirection = NumberUtil.round(windDirectionDate[i][j], 0).doubleValue();
                    properties.put("direction", String.valueOf(windDirection));
                }
                JSONObject feature = new JSONObject();
                feature.put("type", "Feature");
                feature.put("properties", properties);
                feature.put("geometry", new JSONObject().fluentPut("coordinates", lngLat).fluentPut("type", "Point"));
                features.add(feature);
            }
        }
        geoJSON.put("features", features);
        return geoJSON;
    }

    /**
     * 离散点数据轮廓处理
     *
     * @param clipXs     裁剪边界经度
     * @param clipYs     裁剪边界纬度
     * @param xMin       最小经度
     * @param xMax       最大经度
     * @param yMin       最小纬度
     * @param yMax       最大纬度
     * @param xNum       径向格点数
     * @param yNum       纬向格点数
     * @param undefValue 无效值
     * @param algorithm  插值算法
     * @param interval   轮廓色标值区间
     * @param type       输出类型
     * @return 结果
     */
    public JSONObject toJSON(
        double[][] gridData,
        double[] clipXs,
        double[] clipYs,
        double xMin,
        double xMax,
        double yMin,
        double yMax,
        int xNum,
        int yNum,
        double undefValue,
        InterpolateAlgorithm algorithm,
        InterpolateColor.Interval interval,
        ContourOutType type,
        double[][] idwData
    ) {
        // 轮廓区间值
        double[] contourValues = interval.getValues();
        // 创建栅格坐标
        double[] gridX = new double[xNum];
        double[] gridY = new double[yNum];
        Interpolate.createGridXY_Num(xMin, yMin, xMax, yMax, gridX, gridY);

        long start = System.currentTimeMillis();
        if (algorithm != null) {
            // 插值获得网格数据
            gridData = interpolate(gridData, gridX, gridY, undefValue, algorithm);
            if (idwData != null) {
                for (int i = 0; i < gridData.length; i++) {
                    System.arraycopy(gridData[i], 0, idwData[i], 0, gridData[i].length);
                }
            }
        }
        log.info("插值花费时间{}", (System.currentTimeMillis() - start));
        // 追踪计算网格边界
        int[][] temp = new int[gridData.length][gridData[0].length];
        List<Border> borders = Contour.tracingBorders(gridData, gridX, gridY, temp, undefValue);

        // 追踪计算轮廓线
        List<PolyLine> contourLines = Contour.tracingContourLines(
            gridData,
            gridX,
            gridY,
            contourValues.length,
            contourValues,
            undefValue,
            borders,
            temp
        );
        // 平滑处理轮廓线
        List<PolyLine> lines = Contour.smoothLines(contourLines);
        if (ContourOutType.POLYLINE.equals(type)) {
            return toPolyLineJson(lines, clipXs, clipYs, interval);
        }
        long start2 = System.currentTimeMillis();
        // 追踪计算轮廓面
        List<Polygon> polygons = Contour.tracingPolygons(gridData, lines, borders, contourValues);
        log.info("追踪计算轮廓面花费时间{}", (System.currentTimeMillis() - start2));
        // 输出等值面 GeoJSON
        if (ContourOutType.POLYGON.equals(type)) {
            return toPolygonJson(polygons, clipXs, clipYs, interval);
        }

        // 判断是否需要处理成图像输出
        if (ContourOutType.IMAGE.equals(type)) {
            JSONObject polygonJson = toPolygonJson(polygons, clipXs, clipYs, interval);
            return toImageJson(polygonJson, xMin, xMax, yMin, yMax, xNum, yNum);
        }

        return new JSONObject();
    }

    /**
     * 离散点数据轮廓处理
     *
     * @param xs         经度
     * @param ys         纬度
     * @param values     观测值
     * @param clipXs     裁剪边界经度
     * @param clipYs     裁剪边界纬度
     * @param xMin       最小经度
     * @param xMax       最大经度
     * @param yMin       最小纬度
     * @param yMax       最大纬度
     * @param xNum       径向格点数
     * @param yNum       纬向格点数
     * @param undefValue 无效值
     * @param algorithm  插值算法
     * @param interval   轮廓色标值区间
     * @param type       输出类型
     * @return 结果
     */
    public JSONObject toJSON(
        double[] xs,
        double[] ys,
        double[] values,
        double[] clipXs,
        double[] clipYs,
        double xMin,
        double xMax,
        double yMin,
        double yMax,
        int xNum,
        int yNum,
        double undefValue,
        InterpolateAlgorithm algorithm,
        InterpolateColor.Interval interval,
        ContourOutType type,
        double[][] idwData
    ) {
        // 轮廓区间值
        double[] contourValues = interval.getValues();
        // 处理离散数据
        double[][] discreteData = processDiscreteValues(xs, ys, values, contourValues);

        return toJSON(
            discreteData,
            clipXs,
            clipYs,
            xMin,
            xMax,
            yMin,
            yMax,
            xNum,
            yNum,
            undefValue,
            algorithm,
            interval,
            type,
            idwData
        );
    }

    /**
     * 根据算法将离散点数据插值成网格数据
     *
     * @param discreteData 离散点数据
     * @param gridX        网格 X 坐标集合（eg: Lon List）
     * @param gridY        网格 Y 坐标集合（eg: Lat List）
     * @param undefValue   默认值
     * @param algorithm    算法 {@link InterpolateAlgorithm}
     * @return 插值后的网格数据
     */
    public double[][] interpolate(
        double[][] discreteData,
        double[] gridX,
        double[] gridY,
        double undefValue,
        InterpolateAlgorithm algorithm
    ) {
        // 定义网格数据
        double[][] gridData = new double[gridX.length][gridY.length];

        // 根据指定算法进行插值处理
        if (InterpolateAlgorithm.IDW_NEIGHBOR.equals(algorithm)) {
            gridData = Interpolate.interpolation_IDW_Neighbor(discreteData, gridX, gridY, 4, undefValue);
        } else if (InterpolateAlgorithm.IDW_RADIUS.equals(algorithm)) {
            gridData = Interpolate.interpolation_IDW_Radius(discreteData, gridX, gridY, 4, 2, undefValue);
        } else if (InterpolateAlgorithm.IDW_RADIUS_KD_TREE.equals(algorithm)) {
            gridData = Interpolate.idw_Radius_kdTree(discreteData, gridX, gridY, 4, 2, undefValue);
        } else if (InterpolateAlgorithm.CRESSMAN.equals(algorithm)) {
            List<Double> list = Arrays.asList(10D, 8D, 6D, 4D, 2D);
            gridData = Interpolate.cressman(discreteData, gridX, gridY, undefValue, list);
        } else if (InterpolateAlgorithm.CRESSMAN_KD_TREE.equals(algorithm)) {
            List<Double> list = Arrays.asList(10D, 8D, 6D, 4D, 2D);
            gridData = Interpolate.cressman_kdTree(discreteData, gridX, gridY, undefValue, list);
        } else if (InterpolateAlgorithm.GDAL_IDW.equals(algorithm)) {
            double gridSpacing =
                (Arrays.stream(gridX).max().getAsDouble() - Arrays.stream(gridX).min().getAsDouble()) /
                (gridX.length - 1);
            gridData =
                GeoTools.gdalIdw(
                    discreteData,
                    Arrays.stream(gridX).min().getAsDouble(),
                    Arrays.stream(gridY).min().getAsDouble(),
                    Arrays.stream(gridX).max().getAsDouble(),
                    Arrays.stream(gridY).max().getAsDouble(),
                    gridSpacing,
                    gridSpacing
                );
        }

        return gridData;
    }

    /**
     * 获取裁剪点集合
     *
     * @param clipXs Lon List
     * @param clipYs Lat List
     * @return List<PointD>
     */
    public List<PointD> getClipPointList(double[] clipXs, double[] clipYs) {
        List<PointD> list = new ArrayList<>();
        if (clipXs != null && clipYs != null) {
            for (int i = 0; i < clipXs.length; i++) {
                list.add(new PointD(clipXs[i], clipYs[i]));
            }
        }
        return list;
    }

    /**
     * 保存js文件
     *
     * @param savePath 盘符开始的全路径
     * @param content  保存内容
     */
    public static boolean saveToFile(String savePath, JSONObject content) {
        FileWriter writer = null;
        try {
            log.info("入库{},", savePath);
            long s1 = System.currentTimeMillis();
            FileUtil.file(savePath);
            writer = new FileWriter(savePath);
            writer.write(content.toJSONString());
            writer.flush();
            log.info("{} 花费 {}", savePath, System.currentTimeMillis() - s1);
        } catch (IOException e) {
            log.info(e.getMessage(), e);
            throw new RuntimeException(e);
        } finally {
            IoUtil.close(writer);
        }
        return true;
    }

    /**
     * 将 Polygons 根据`数值区间`转换为 GeoJSON
     *
     * @param polygons Polygon List
     * @param interval NumericalColor.Interval
     * @return GeoJSON
     */
    public static JSONObject toPolygonJson(
        List<Polygon> polygons,
        double[] clipXs,
        double[] clipYs,
        InterpolateColor.Interval interval
    ) {
        long start = System.currentTimeMillis();
        List<PointD> clips = getClipPointList(clipXs, clipYs);
        if (!clips.isEmpty()) {
            polygons = Contour.clipPolygons(polygons, clips);
        }

        String features = polygons
            .parallelStream()
            .map(polygon -> {
                List<String> lines = new ArrayList<>();
                lines.add("\"type\":\"Feature\"");
                List<String> coordinates = new ArrayList<>();
                PointD pointFirst = polygon.OutLine.PointList.get(0);
                double firstX = pointFirst.X;
                double firstY = pointFirst.Y;
                PointD pointLast = polygon.OutLine.PointList.get(polygon.OutLine.PointList.size() - 1);
                double lastX = pointLast.X;
                double lastY = pointLast.Y;
                double absX = Math.abs(NumberUtil.sub(firstX, lastX));
                if (absX > 0) {
                    pointLast.X = firstX;
                }
                double absY = Math.abs(NumberUtil.sub(firstY, lastY));
                if (absY > 0) {
                    pointLast.Y = firstY;
                }
                coordinates.add(
                    "[" +
                    polygon.OutLine.PointList
                        .stream()
                        .map(point -> "[" + formatDouble(point.X) + "," + formatDouble(point.Y) + "]")
                        .collect(Collectors.joining(",")) +
                    "]"
                );
                if (polygon.HasHoles()) {
                    coordinates.add(
                        polygon.HoleLines
                            .parallelStream()
                            .map(line -> {
                                PointD pointFirst1 = line.PointList.get(0);
                                double firstX1 = pointFirst1.X;
                                double firstY1 = pointFirst1.Y;
                                PointD pointLast1 = line.PointList.get(line.PointList.size() - 1);
                                double lastX1 = pointLast1.X;
                                double lastY1 = pointLast1.Y;
                                double absX1 = Math.abs(NumberUtil.sub(firstX1, lastX1));
                                if (absX1 > 0 && absX1 < 0.0001) {
                                    pointLast1.X = firstX1;
                                }
                                double absY1 = Math.abs(NumberUtil.sub(firstY1, lastY1));
                                if (absY1 > 0 && absY1 < 0.0001) {
                                    pointLast1.Y = firstY1;
                                }
                                return (
                                    "[" +
                                    line.PointList
                                        .stream()
                                        .map(point -> ("[" + formatDouble(point.X) + "," + formatDouble(point.Y) + "]"))
                                        .collect(Collectors.joining(",")) +
                                    "]"
                                );
                            })
                            .collect(Collectors.joining(","))
                    );
                }
                lines.add(
                    "\"geometry\":{\"type\":\"Polygon\",\"coordinates\":[" + String.join(",", coordinates) + "]}"
                );

                String color = getRangeColor(interval, polygon.LowValue, polygon.IsHighCenter);
                lines.add("\"properties\":{\"color\":\"" + color + "\"}");

                return "{" + String.join(",", lines) + "}";
            })
            .collect(Collectors.joining(","));
        String result = "{\"type\":\"FeatureCollection\",\"features\":[" + features + "]}";

        log.info("等值面处理花费 {}", System.currentTimeMillis() - start);
        return JSONObject.parseObject(result);
    }

    public static String formatDouble(double value) {
        DecimalFormat decimalFormat = new DecimalFormat("#.######");
        return decimalFormat.format(value);
    }

    /**
     * 将 Polygons 根据`数值区间`转换为 GeoJSON
     *
     * @param polygons Polygon List
     * @param interval NumericalColor.Interval
     * @return GeoJSON
     */
    private static JSONObject toPolygonJson2(
        List<Polygon> polygons,
        double[] clipXs,
        double[] clipYs,
        InterpolateColor.Interval interval
    ) {
        long start = System.currentTimeMillis();
        List<PointD> clips = getClipPointList(clipXs, clipYs);
        if (!clips.isEmpty()) {
            polygons = Contour.clipPolygons(polygons, clips);
        }

        String features = polygons
            .parallelStream()
            .map(polygon -> {
                List<String> lines = new ArrayList<>();
                lines.add("\"type\":\"Feature\"");
                List<String> coordinates = new ArrayList<>();
                PointD pointFirst = polygon.OutLine.PointList.get(0);
                Double firstX = NumberUtil.round(pointFirst.X, 6).doubleValue();
                Double firstY = NumberUtil.round(pointFirst.Y, 6).doubleValue();
                PointD pointLast = polygon.OutLine.PointList.get(polygon.OutLine.PointList.size() - 1);
                Double lastX = NumberUtil.round(pointLast.X, 6).doubleValue();
                Double lastY = NumberUtil.round(pointLast.Y, 6).doubleValue();
                double absX = Math.abs(NumberUtil.sub(firstX, lastX));
                if (absX > 0) {
                    pointLast.X = firstX;
                }
                double absY = Math.abs(NumberUtil.sub(firstY, lastY));
                if (absY > 0) {
                    pointLast.Y = firstY;
                }
                coordinates.add(
                    "[" +
                    polygon.OutLine.PointList
                        .stream()
                        .map(point ->
                            "[" +
                            NumberUtil.round(point.X, 6).doubleValue() +
                            "," +
                            NumberUtil.round(point.Y, 6).doubleValue() +
                            "]"
                        )
                        .collect(Collectors.joining(",")) +
                    "]"
                );
                if (polygon.HasHoles()) {
                    coordinates.add(
                        polygon.HoleLines
                            .stream()
                            .map(line -> {
                                PointD pointFirst1 = line.PointList.get(0);
                                Double firstX1 = NumberUtil.round(pointFirst1.X, 6).doubleValue();
                                Double firstY1 = NumberUtil.round(pointFirst1.Y, 6).doubleValue();
                                PointD pointLast1 = line.PointList.get(line.PointList.size() - 1);
                                Double lastX1 = NumberUtil.round(pointLast1.X, 6).doubleValue();
                                Double lastY1 = NumberUtil.round(pointLast1.Y, 6).doubleValue();
                                double absX1 = Math.abs(NumberUtil.sub(firstX1, lastX1));
                                if (absX1 > 0 && absX1 < 0.0001) {
                                    pointLast1.X = firstX1;
                                }
                                double absY1 = Math.abs(NumberUtil.sub(firstY1, lastY1));
                                if (absY1 > 0 && absY1 < 0.0001) {
                                    pointLast1.Y = firstY1;
                                }
                                return (
                                    "[" +
                                    line.PointList
                                        .stream()
                                        .map(point ->
                                            (
                                                "[" +
                                                NumberUtil.round(point.X, 6) +
                                                "," +
                                                NumberUtil.round(point.Y, 6) +
                                                "]"
                                            )
                                        )
                                        .collect(Collectors.joining(",")) +
                                    "]"
                                );
                            })
                            .collect(Collectors.joining(","))
                    );
                }
                lines.add(
                    "\"geometry\":{\"type\":\"Polygon\",\"coordinates\":[" + String.join(",", coordinates) + "]}"
                );

                String color = getRangeColor(interval, polygon.LowValue, polygon.IsHighCenter);
                lines.add("\"properties\":{\"color\":\"" + color + "\"}");

                return "{" + String.join(",", lines) + "}";
            })
            .collect(Collectors.joining(","));
        String result = "{\"type\":\"FeatureCollection\",\"features\":[" + features + "]}";

        log.info("等值面处理花费 {}", System.currentTimeMillis() - start);
        return JSONObject.parseObject(result);
    }

    /**
     * 将 等值线 根据`数值区间`转换为 GeoJSON
     *
     * @param lines    PolyLine List
     * @param interval NumericalColor.Interval
     * @return GeoJSON
     */
    private JSONObject toPolyLineJson(
        List<PolyLine> lines,
        double[] clipXs,
        double[] clipYs,
        InterpolateColor.Interval interval
    ) {
        // 判断是否需要裁剪等值线
        List<PointD> clips = getClipPointList(clipXs, clipYs);
        if (!clips.isEmpty()) {
            lines = Contour.clipPolylines(lines, clips);
        }

        JSONArray features = lines
            .stream()
            .map(polyLine -> {
                JSONObject feature = new JSONObject();
                feature.put("type", "Feature");

                List<Object> coordinates = polyLine.PointList
                    .stream()
                    .map(point -> new double[] { point.X, point.Y })
                    .collect(Collectors.toList());

                JSONObject geometry = new JSONObject();
                geometry.put("type", "LineString");
                geometry.put("coordinates", coordinates);
                feature.put("geometry", geometry);

                // 属性
                JSONObject properties = new JSONObject();
                properties.put("value", polyLine.Value);
                properties.put("stroke", getRangeColor(interval, polyLine.Value, false));
                feature.put("properties", properties);

                return feature;
            })
            .collect(Collectors.toCollection(JSONArray::new));

        JSONObject json = new JSONObject();
        json.put("type", "FeatureCollection");
        json.put("features", features);
        return json;
    }

    /**
     * 等值面转图片输出（RGB）
     *
     * @param polygonJson 等值面 GeoJSON
     * @param xMin        最小经度
     * @param xMax        最大经度
     * @param yMin        最小纬度
     * @param yMax        最大纬度
     * @param width       径向格点数
     * @param height      纬向格点数
     * @return Base64 图像及描述信息
     */
    @SuppressWarnings({ "unchecked" })
    private JSONObject toImageJson(
        JSONObject polygonJson,
        double xMin,
        double xMax,
        double yMin,
        double yMax,
        int width,
        int height
    ) {
        // 构建图片描述信息
        JSONObject header = new JSONObject();
        header.put("nx", width);
        header.put("ny", height);
        header.put("dx", (double) Math.round((xMax - xMin) / width * 100) / 100);
        header.put("dy", (double) Math.round((yMax - yMin) / height * 100) / 100);
        header.put("extent", new double[] { xMin, yMin, xMax, yMax });

        // 绘图
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_4BYTE_ABGR);
        Graphics2D g = img.createGraphics();
        JSONArray features = polygonJson.getJSONArray("features");
        for (Object obj : features) {
            JSONObject feature = (JSONObject) obj;
            JSONObject properties = feature.getJSONObject("properties");
            JSONObject geometry = feature.getJSONObject("geometry");
            JSONArray coordinates = geometry.getJSONArray("coordinates");

            // 将空间面转换成图像对应像素面信息
            java.awt.Polygon shape = new java.awt.Polygon();
            for (Object tmp : coordinates) {
                List<Object> array = (ArrayList<Object>) tmp;
                for (Object item : array) {
                    double[] coordinate = (double[]) item;
                    int[] xy = latLon2XY(coordinate[0], coordinate[1], xMin, xMax, yMin, yMax, width, height);
                    shape.addPoint(xy[0], xy[1]);
                }
            }

            // 统计头部信息最大最小值
            double value = properties.getDoubleValue("value");
            if (header.containsKey("min")) {
                double prevValue = header.getDoubleValue("min");
                header.put("min", Math.min(prevValue, value));
            } else {
                header.put("min", value);
            }
            if (header.containsKey("max")) {
                double prevValue = header.getDoubleValue("max");
                header.put("max", Math.max(prevValue, value));
            } else {
                header.put("max", value);
            }

            // 绘制面及填色
            g.setColor(new Color(Integer.parseInt(properties.getString("fill").substring(1), 16)));
            g.fill(shape);
        }

        JSONObject image = new JSONObject();
        image.put("header", header);
        image.put("data", toBase64(img));
        return image;
    }

    /**
     * BufferedImage 转 Base64 PNG 图片编码
     *
     * @param image BufferedImage 对象
     * @return PNG 图片 Base64 编码
     */
    public String toBase64(BufferedImage image) {
        try {
            ByteArrayOutputStream stream = new ByteArrayOutputStream();
            ImageIO.write(image, "png", stream);
            return "data:image/png;base64," + Base64.encode(stream.toByteArray());
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            return "";
        }
    }

    /**
     * 获取区间 颜色
     *
     * @param interval 区间描述常量
     * @param lv       最低值
     * @return 对应的色标颜色
     */
    private String getRangeColor(InterpolateColor.Interval interval, double lv, boolean isHighCenter) {
        int index = indexOfArray(interval.getValues(), lv);
        return interval.getColors()[!isHighCenter ? index : index + 1];
    }

    /**
     * 查找一个数值在数组中的下标
     *
     * @param array 数组
     * @param value 值
     * @return 下标
     */
    private static int indexOfArray(double[] array, double value) {
        int n = -1;
        for (int i = 0; i < array.length; i++) {
            if (array[i] == value) {
                n = i;
                break;
            }
        }
        return n;
    }

    private static int indexOfRangeArray(double[] array, double value) {
        int n = 0;
        for (int i = array.length - 1; i >= 0; i--) {
            if (array[i] <= value) {
                n = i;
                break;
            }
        }
        return n;
    }

    /**
     * 经纬度换算成相对坐标
     *
     * @param lon    经度
     * @param lat    维度
     * @param xMin   最小经度
     * @param xMax   最大经度
     * @param yMin   最小纬度
     * @param yMax   最大纬度
     * @param width  径向格点数
     * @param height 纬向格点数
     * @return XY 坐标
     */
    public static int[] latLon2XY(
        double lon,
        double lat,
        double xMin,
        double xMax,
        double yMin,
        double yMax,
        int width,
        int height
    ) {
        return new int[] {
            (int) ((lon - xMin) / (xMax - xMin) * width),
            (int) ((yMax - lat) / (yMax - yMin) * height),
        };
    }
}
