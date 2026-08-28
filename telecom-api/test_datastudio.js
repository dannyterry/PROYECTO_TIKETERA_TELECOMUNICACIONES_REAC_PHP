async function testDatastudio() {
  const url = 'https://datastudio.google.com/u/0/batchedDataV2?appVersion=20260823_0000';
  
  const headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "es-419,es;q=0.9",
    "content-type": "application/json",
    "origin": "https://datastudio.google.com",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Chromium\";v=\"152\", \"Not?A_Brand\";v=\"24\", \"Google Chrome\";v=\"152\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
    "x-browser-channel": "stable",
    "x-browser-copyright": "Copyright 2026 Google LLC. All Rights Reserved.",
    "x-browser-validation": "DD7V8Qhc96Al9nfPAmKmyHrwyTQ=",
    "x-browser-year": "2026",
    "x-client-data": "CKmdygEIlqHLAQiFoM0BCO7flDAIluKUMBi0s88BGKnYlDAYqN6UMBir35Qw",
    "x-rap-xsrf-token": "AImk1AKsLUVApeGYTRDHEqhXWWfaybit2A:1787924648703",
    "cookie": "RAP_XSRF_TOKEN=AImk1AKsLUVApeGYTRDHEqhXWWfaybit2A:1787924648703; SEARCH_SAMESITE=CgQIhqEB; __Secure-BUCKET=CJoD; HSID=AQrFy9lSB2dWScZFq; SSID=AnDBxif28MMVj7mGL; APISID=3sZ7IjXyR2enWxRI/AlNogBx4ERi4VKBi3; SAPISID=DW66H_qCLhW0I4hh/A6hU5xKQLeaSIoA_1; __Secure-1PAPISID=DW66H_qCLhW0I4hh/A6hU5xKQLeaSIoA_1; __Secure-3PAPISID=DW66H_qCLhW0I4hh/A6hU5xKQLeaSIoA_1; SID=g.a000Bwm33xtk6H2pjK4dxiYRrN5jP_fmbh8MFghnb5hlpMxxowfXfXuoKe-_XT_jcEKkLCEEfQACgYKAT0SARQSFQHGX2Mi_TFb3aTUYuYFyXPyErY4vBoVAUF8yKqX7KJr7_f6wBNb27Mfde4_0076; __Secure-1PSID=g.a000Bwm33xtk6H2pjK4dxiYRrN5jP_fmbh8MFghnb5hlpMxxowfXkeHIrDyyq-6ndLpc2nJkbQACgYKASQSARQSFQHGX2MiYvxcEUMOgUoO0ZMAhAmRORoVAUF8yKojBGHItcCZzjiikPHk8XAo0076; __Secure-3PSID=g.a000Bwm33xtk6H2pjK4dxiYRrN5jP_fmbh8MFghnb5hlpMxxowfXIOJN2kxsCjQ8UUfs3Xb0bgACgYKAWYSARQSFQHGX2Mi6a2-eAZ80RZ6ucRgkxYDsRoVAUF8yKo4AvJGbp6et3-kbBQiDSMu0076; AEC=AdJVEavK3eo3n5-nTcQaWuOX3miiqB7A6AJt02VxmkXp5Gu4Avz9yDrlDwY; _gid=GA1.3.301153668.1787846036; NID=534=UdmdzFnjR3HMEIdmop7fzr0PBk6-iLPUBYL0gGtoK6E6NaY7Pfsd2VSR1TOu4oTUtfLitTJeLbekSsVHqedhFio68pFHpTAEj3KwmYYWBWft3Sf32Pzjp-q_r-2DV0Rmfbe-CLsU-etE5-45GtMiUITmulU2skBnTt4Ivm01U7-r4qvzQUfBrr-jJiY_qsiP1oDNtaSEYtDN3iv83d-1gSM2_DdZWYA7kXw1Y1Dcnuh5jqVP1YWS53vqkAfYvjGp7f7iMdfgIYm1OXBb5Rui2CCb6wIJ2lFNlaO-ijZQvVm5H9R9_tlp_e_L2NXqH2BofALHwLlJLKZVUy0IHLwe7I6wai8RNA1lVa0ONVGmyRLqzyKTOM5GRLe3U0QY8rNebdWJAZSeJ6j6plyEhQHepFHJjQ08fpnsLNQ9-MrEpz2Vp7JBpf3U7U6yDI0jjGj22zzYzSLmGfMNs91zQIJ0Naah0BHvgc4O54oemlTTcLw2gf4fNlSKGQKWkNB4pcjvEqw5lHEYtmHHu-My-PvwJ4FlBfvoOZzVFG-yAL8vy3i7wt4khIT1TotSSQxBc8P8B_3C6N2txsW8LhwPh6gyAbqlki6fQWBR4rwqMxLYSdZzQ6evKRfrpWJN1ybgIVrqF2SziBvXcW68YWHBHsW5aFHJA0Wc4YTQ-NbyTlIEf9UYnQh87xbsk37w81-819rWxjqYYxSxM_JjyWwvBxn_o4z9EVPOhtdjEuKl2CDt9da7Ro9cINsFE40YHytkev28CYXKlFn9fXEHvxy-; __Secure-1PSIDTS=sidts-CjcBXMw41SPbhXElfAJzfr10uM9WFzlCvoKIffMhRrNh6Im51cgxi8ZsoRRK15nGZ9wGFbSAsOpgEAA; __Secure-1PSIDRTS=sidts-CjcBXMw41SPbhXElfAJzfr10uM9WFzlCvoKIffMhRrNh6Im51cgxi8ZsoRRK15nGZ9wGFbSAsOpgEAA; __Secure-3PSIDTS=sidts-CjcBXMw41SPbhXElfAJzfr10uM9WFzlCvoKIffMhRrNh6Im51cgxi8ZsoRRK15nGZ9wGFbSAsOpgEAA; __Secure-3PSIDRTS=sidts-CjcBXMw41SPbhXElfAJzfr10uM9WFzlCvoKIffMhRrNh6Im51cgxi8ZsoRRK15nGZ9wGFbSAsOpgEAA; _ga_RSGD49T48R=GS2.1.s1787923274$o9$g1$t1787924646$j60$l0$h0; _gat=1; _ga=GA1.3.759491289.1777988907; _gat_marketingTracker=1; SIDCC=AKEyXzW-1lcDIDVzF2fYucEViL1hJ4bndvkcDPGP0ImbCfsNQg3fNaGCB2lehBTi7mTQ-6AfwXGG; __Secure-1PSIDCC=AKEyXzU-WUF3epywXIIdjeG0kMotRIJQ7Zazx-70mF039yKPSEkV-Bh6nWZZJGkWI7nQP26y8D7N; __Secure-3PSIDCC=AKEyXzWLrjH2Ndp_2EztyiR7-c3dqR6_lznF9Z2XWYqhVl4f29_0nyMmGuvH0VeSZOZxpZHdILDf; _ga_S4FJY0X3VX=GS2.1.s1787923270$o35$g1$t1787924650$j56$l0$h0",
    "Referer": "https://datastudio.google.com/u/0/reporting/15ece5ee-2129-40d6-8122-d83aebc89318/page/p_lfut5i1r5d"
  };

  const body = {
    "dataRequest": [
      {
        "requestContext": {
          "reportContext": {
            "reportId": "15ece5ee-2129-40d6-8122-d83aebc89318",
            "pageId": "p_lfut5i1r5d",
            "mode": 1,
            "componentId": "cd-cntt5i1r5d",
            "displayType": "kpi-metric"
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
          "queryFields": [
            {
              "name": "qt_ni2ttw6t5d",
              "datasetNs": "d0",
              "tableNs": "t0",
              "dataTransformation": {
                "sourceFieldName": "datastudio_record_count_system_field_id_98323387"
              }
            }
          ],
          "sortData": [],
          "includeRowsCount": false,
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
              "name": "qt_7w7ttw6t5d",
              "datasetNs": "d0",
              "tableNs": "t0",
              "dataTransformation": {
                "sourceFieldName": "_14122113_"
              }
            }
          ],
          "calculatedField": [],
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
          "originalRequestId": "cd-cntt5i1r5d_0_0"
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
    console.log('Status:', res.status);
    let rawText = await res.text();
    if (rawText.startsWith(")]}'")) {
      rawText = rawText.substring(4);
    }
    const parsed = JSON.parse(rawText);
    console.log('Parsed Response:', JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testDatastudio();
