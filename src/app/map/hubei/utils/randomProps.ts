import { booleanPointInPolygon } from '@turf/turf';
import type { FeatureCollection, Feature, Point, Polygon, MultiPolygon } from 'geojson';
import type { JsonObject } from '../types';

// 类型选项
export type TypeOption = { label: string; value: string };

// 为单个点生成随机属性

// {
//           "earlyMd5Id": "579f1800fd0e6b5b2fb66039ae7d4f9b",
//           "earlyType": "暴雨",
//           "earlyLevel": "3",
//           "sendContent": "安仁县气象台2025年9月1日17时3分发布暴雨黄色预警信号：预计安仁县未来6小时降雨量将达50毫米以上，最大小时雨强30毫米以上，并伴随雷雨大风、雷电等强对流天气，致灾风险较高，请注意防范。",
//           "sendUnit": "安仁县气象台",
//           "submitTime": "2025-09-01 17:03:53",
//           "validPeriod": "6",
//           "relevantArea": "[\"431028\"]",
//           "endTime": "2025-12-01 23:03:53",
//           "earlyTypePy": "by",
//           "unitType": 3,
//           "areaDetails": [
//               {
//                   "adminCode": "431028",
//                   "lat": 26.579,
//                   "lon": 113.363,
//                   "areaName": "安仁县"
//               }
//           ]
//       }

const customProps = () => {
  return {
    "earlyMd5Id": "579f1800fd0e6b5b2fb66039ae7d4f9b",
    "earlyType": "暴雨",
    "earlyLevel": "3",
    "sendContent": "安仁县气象台2025年9月1日17时3分发布暴雨黄色预警信号：预计安仁县未来6小时降雨量将达50毫米以上，最大小时雨强30毫米以上，并伴随雷雨大风、雷电等强对流天气，致灾风险较高，请注意防范。",
    "sendUnit": "安仁县气象台",
    "submitTime": "2025-09-01 17:03:53",
    "validPeriod": "6",
    "relevantArea": "[\"431028\"]",
    "endTime": "2025-12-01 23:03:53",
    "earlyTypePy": "by",
    "unitType": 3,
    "areaDetails": [
      {
        "adminCode": "431028",
        "lat": 26.579,
        "lon": 113.363,
        "areaName": "安仁县"
      }
    ]
  }
}
export function generateRandomPropsForPoint(
  feat: Feature<Point>,
  districtFC: FeatureCollection<Polygon | MultiPolygon> | null,
  typesOpts: TypeOption[],
  baseProps?: JsonObject | null
): JsonObject {
  const pick = typesOpts[Math.floor(Math.random() * Math.max(1, typesOpts.length))];
  let addr = '湖北省';
  if (districtFC) {
    let matchedName: string | null = null;
    for (const poly of districtFC.features) {
      if (booleanPointInPolygon(feat as any, poly as any)) {
        const props = (poly.properties ?? {}) as Record<string, unknown>;
        const nameRaw = props['name'];
        matchedName = typeof nameRaw === 'string' ? nameRaw : null;
        break;
      }
    }
    if (matchedName) addr = `湖北省${matchedName}`;
  }

  const merged: JsonObject = {
    ...(feat.properties ?? {}),
    ...(baseProps ?? {}),
    insuranceType: pick.label,
    insuranceTypeValue: pick.value,
    address: addr,
  };
  return merged;
}

// 批量为集合生成属性
export function enrichFeatureCollection(
  fc: FeatureCollection<Point>,
  districtFC: FeatureCollection<Polygon | MultiPolygon> | null,
  typesOpts: TypeOption[],
  baseProps?: JsonObject | null
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((feat) => ({
      ...feat,
      properties: generateRandomPropsForPoint(feat, districtFC, typesOpts, baseProps),
    })),
  };
}