const fs = require('fs');

async function fetchTableData() {
  const url = 'https://datastudio.google.com/u/0/batchedDataV2?appVersion=20260823_0000';
  
  const headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "es-419,es;q=0.9",
    "content-type": "application/json",
    "origin": "https://datastudio.google.com",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Not=A?Brand\";v=\"99\", \"Google Chrome\";v=\"151\", \"Chromium\";v=\"151\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    "x-browser-channel": "stable",
    "x-browser-copyright": "Copyright 2026 Google LLC. All Rights Reserved.",
    "x-browser-validation": "1np4czHTgmmEnZuHzsr7dj6pNow=",
    "x-browser-year": "2026",
    "x-client-data": "CKmdygEIlKHLAQiFoM0BCO7flDAIl+KUMBi0s88BGKnYlDAYqN6UMBir35Qw",
    "x-rap-xsrf-token": "AImk1AKvH6jKotnu8x3lcNW0h5zjdTYGvQ:1787867689623",
    "cookie": "RAP_XSRF_TOKEN=AImk1AKvH6jKotnu8x3lcNW0h5zjdTYGvQ:1787867689623; SEARCH_SAMESITE=CgQIhqEB; __Secure-BUCKET=CJoD; HSID=AQrFy9lSB2dWScZFq; SSID=AnDBxif28MMVj7mGL; APISID=3sZ7IjXyR2enWxRI/AlNogBx4ERi4VKBi3; SAPISID=DW66H_qCLhW0I4hh/A6hU5xKQLeaSIoA_1; __Secure-1PAPISID=DW66H_qCLhW0I4hh/A6hU5xKQLeaSIoA_1; __Secure-3PAPISID=DW66H_qCLhW0I4hh/A6hU5xKQLeaSIoA_1; SID=g.a000Bwm33xtk6H2pjK4dxiYRrN5jP_fmbh8MFghnb5hlpMxxowfXfXuoKe-_XT_jcEKkLCEEfQACgYKAT0SARQSFQHGX2Mi_TFb3aTUYuYFyXPyErY4vBoVAUF8yKqX7KJr7_f6wBNb27Mfde4_0076; __Secure-1PSID=g.a000Bwm33xtk6H2pjK4dxiYRrN5jP_fmbh8MFghnb5hlpMxxowfXkeHIrDyyq-6ndLpc2nJkbQACgYKASQSARQSFQHGX2MiYvxcEUMOgUoO0ZMAhAmRORoVAUF8yKojBGHItcCZzjiikPHk8XAo0076; __Secure-3PSID=g.a000Bwm33xtk6H2pjK4dxiYRrN5jP_fmbh8MFghnb5hlpMxxowfXIOJN2kxsCjQ8UUfs3Xb0bgACgYKAWYSARQSFQHGX2Mi6a2-eAZ80RZ6ucRgkxYDsRoVAUF8yKo4AvJGbp6et3-kbBQiDSMu0076; AEC=AdJVEavK3eo3n5-nTcQaWuOX3miiqB7A6AJt02VxmkXp5Gu4Avz9yDrlDwY; _gid=GA1.3.301153668.1787846036; NID=534=aJtcPpidRueL_1fqDBiNVnLwLp7fQO-_6Gs6gi4KIYHksu7Q_8S9mEx90ohpfMroziFZaYNy8BZsOGkUzHEfNnwoLuRqRzXG7aBEq5LKwA_ulSBHza4w4EkwY7b8avHracKDVIW4Q-N-_tRr0pKh-FCh7lvQOcUCqUUh3e7PFrly3YeDDPgoPTE9c8UnOxoOHqncJ9psqUQk2Y3tsSoPbxcMfmcreckB7mfBrC9PTvc1_lXMVSXCHOmLu7N6QnE2FZlnV-Pf2BDP26Ri4_8k3JQZ7VvxOf8c73Eo7KQD3wV4MScRMSTDj33NY9w8VXa9qb1YBL3DvqqARp2hJLpgltXZFZ3r778Wf28hcC-osr1JPUCAY3vxUAM94mEXmH3_BdBRxpHzjlQq4p0PkZ6_yvy7XNcDuBXcZHTpOWnEPfufHERvhqIc2b_FUInPuTvNq3VzsHufF7Oo5rtUuPa5BClwZOu32OD9Zafn8rQYN9f3bwGr2Q-KR0QRcsT_JZBFm0ddMoapSAuBqnftdINQiivZpIiAz6tTTm172y_BwYOsl2Aa7Ry-anApfpvX4HMN7PK6PFnxKOukjjnhwQ7YYUyMdekSQhnfP5oBXa8rwxPirv14NtMGFZnyqalvO5socc-HjRduJEFq8eYQbaaBMTwQTYbmYPpJTHYuBwUvZ_8mLHRRmfESlwcsH3CV1Pd6zCieqdEAtDQM7SJWwWir_ZPtyDzxMX_nKwCigCEnzbHVOzR6-dtg8kUqfF1VCq1gigQezeYlnnKpnX1K; __Secure-1PSIDTS=sidts-CjcBXMw41ehvA8paiZpmN7M9s-L7T-SIhkQqzx7UIrPQpUJNXNnuteL9MVDorSN9Rx7bErElJPGlEAA; __Secure-1PSIDRTS=sidts-CjcBXMw41ehvA8paiZpmN7M9s-L7T-SIhkQqzx7UIrPQpUJNXNnuteL9MVDorSN9Rx7bErElJPGlEAA; __Secure-3PSIDTS=sidts-CjcBXMw41ehvA8paiZpmN7M9s-L7T-SIhkQqzx7UIrPQpUJNXNnuteL9MVDorSN9Rx7bErElJPGlEAA; __Secure-3PSIDRTS=sidts-CjcBXMw41ehvA8paiZpmN7M9s-L7T-SIhkQqzx7UIrPQpUJNXNnuteL9MVDorSN9Rx7bErElJPGlEAA; _ga_RSGD49T48R=GS2.1.s1787866089$o8$g1$t1787867687$j60$l0$h0; _gat=1; _ga=GA1.3.759491289.1777988907; _gat_marketingTracker=1; _ga_S4FJY0X3VX=GS2.1.s1787866089$o34$g1$t1787867690$j57$l0$h0; SIDCC=AKEyXzVKYlZ9h4pzZxYJ2v5JUy_YYDFwijcxSXbQwwybVDeVnEagyMj-UmAWn-XBx0v8iLq26Ifk; __Secure-1PSIDCC=AKEyXzXCFPthNpvNn5FC7n84M9-BCEem36uASxf4Ap7ZmmN4Yh3-LWCzMoynEYOhQmIKYW6FVaRS; __Secure-3PSIDCC=AKEyXzWZY1LcCClX_WeAzwzmx4Vi2mcPxipU1CXd8LDhn5dOz9z8MWG7qopzx4xLnWbk7U71W8dj",
    "Referer": "https://datastudio.google.com/u/0/reporting/15ece5ee-2129-40d6-8122-d83aebc89318/page/p_lfut5i1r5d"
  };

  // Find the exact table component definition from report_raw.json
  const rawReport = JSON.parse(fs.readFileSync('d:/proyecrh/telecom-api/report_raw.json', 'utf8'));
  const targetPage = rawReport.reportConfig.page.find(p => p.pageId === 'p_lfut5i1r5d');
  const tableComp = targetPage.page.componentConfig.find(c => c.type === 'table' || JSON.stringify(c).includes('qt_2d9467as5d'));

  console.log('Found table component ID:', tableComp?.componentId);

  const queryFields = [
    { name: "qt_hh7ye78r5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_n1522618073_" } },
    { name: "qt_hzrit9as5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_2091842744_" } },
    { name: "qt_f97ye78r5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_2791368_" } },
    { name: "qt_uejyhabs5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_353606072_" } },
    { name: "qt_rgjh6qau5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_n1389458739_" } },
    { name: "qt_f5pg0kbs5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "qt_9piuojbs5d" } },
    { name: "qt_ybyxfc7t5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_n350971185_" } },
    { name: "qt_op6ye78r5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_82184_" } },
    { name: "qt_2d9467as5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_3355_" } },
    { name: "qt_n5zpfvau5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_98846_" } }
  ];

  const body = {
    "dataRequest": [
      {
        "requestContext": {
          "reportContext": {
            "reportId": "15ece5ee-2129-40d6-8122-d83aebc89318",
            "pageId": "p_lfut5i1r5d",
            "mode": 1,
            "componentId": tableComp ? tableComp.componentId : "cd-gntt5i1r5d",
            "displayType": "table"
          },
          "requestMode": 0
        },
        "datasetSpec": {
          "dataset": [
            {
              "datasourceId": "c7ce1418-b217-40bf-b71a-feca7098ee4a",
              "revisionNumber": 0,
              "parameterOverrides": []
            }
          ],
          "queryFields": queryFields,
          "sortData": [
            {
              "sortColumn": {
                "name": "qt_hh7ye78r5d",
                "datasetNs": "d0",
                "tableNs": "t0"
              },
              "sortDir": 0
            }
          ],
          "paginate": {
            "startRow": 1,
            "rowCount": 500
          },
          "includeRowsCount": true,
          "relatedDimensionMask": {
            "addDisplay": false,
            "addUniqueId": false,
            "addLatLong": false
          },
          "dsFilterOverrides": [],
          "filters": [
            {
              "filterDefinition": {
                "filterExpression": {
                  "include": true,
                  "conceptType": 0,
                  "concept": {
                    "ns": "t0",
                    "name": "qt_8526ao2r5d"
                  },
                  "filterConditionType": "IN",
                  "stringValues": [
                    "REGULARIZAR",
                    "PROGRAMAR"
                  ],
                  "numberValues": [],
                  "queryTimeTransformation": {
                    "dataTransformation": {
                      "sourceFieldName": "_1438922942_"
                    }
                  }
                }
              },
              "dataSubsetNs": {
                "datasetNs": "d0",
                "tableNs": "t0",
                "contextNs": "c0"
              },
              "version": 3
            },
            {
              "filterDefinition": {
                "filterExpression": {
                  "include": true,
                  "conceptType": 0,
                  "concept": {
                    "ns": "t0",
                    "name": "qt_k3wtbg595d"
                  },
                  "filterConditionType": "IN",
                  "stringValues": [
                    "Pendiente"
                  ],
                  "numberValues": [],
                  "queryTimeTransformation": {
                    "dataTransformation": {
                      "sourceFieldName": "_n1808614382_"
                    }
                  }
                }
              },
              "dataSubsetNs": {
                "datasetNs": "d0",
                "tableNs": "t0",
                "contextNs": "c0"
              },
              "version": 3
            }
          ],
          "features": [],
          "dateRanges": [],
          "contextNsCount": 1,
          "dateRangeDimensions": [
            {
              "name": "qt_zlkze78r5d",
              "datasetNs": "d0",
              "tableNs": "t0",
              "dataTransformation": {
                "sourceFieldName": "_14122113_"
              }
            }
          ],
          "calculatedField": [
            {
              "id": "t0.qt_f5pg0kbs5d",
              "name": "qt_f5pg0kbs5d",
              "namespace": "t0",
              "queryTimeTransformation": {
                "dataTransformation": {
                  "sourceFieldName": "qt_9piuojbs5d",
                  "textFormula": "CASE WHEN t0._n1273805513_ = \"0\" THEN \"Multifamiliar\" ELSE t0._n1273805513_ END",
                  "sourceType": 1,
                  "frontendTextFormula": "CASE WHEN t0._n1273805513_ = \"0\" THEN \"Multifamiliar\" ELSE t0._n1273805513_ END",
                  "formulaOutputDataType": 0
                }
              }
            }
          ],
          "needGeocoding": false,
          "geoFieldMask": [],
          "multipleGeocodeFields": [],
          "timezone": "America/Lima"
        },
        "role": "main",
        "retryHints": {
          "useClientControlledRetry": true,
          "isLastRetry": false,
          "retryCount": 0,
          "originalRequestId": `${tableComp ? tableComp.componentId : "cd-gntt5i1r5d"}_0_0`
        }
      }
    ]
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });
    console.log('Table Fetch Status:', res.status);
    let text = await res.text();
    if (text.startsWith(")]}'")) text = text.substring(4);
    
    fs.writeFileSync('d:/proyecrh/telecom-api/table_data_raw.json', text);
    const parsed = JSON.parse(text);
    console.log('Parsed Table Response:', JSON.stringify(parsed, null, 2).substring(0, 1000));
  } catch (err) {
    console.error('Error fetching table data:', err);
  }
}

fetchTableData();
