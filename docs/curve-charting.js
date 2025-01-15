const HALL_REVERB_TIME_VALUES = [
    0.164,
    0.218,
    0.273,
    0.327,
    0.382,
    0.437,
    0.491,
    0.546,
    0.600,
    0.655,
    0.709,
    0.764,
    0.819,
    0.873,
    0.928,
    0.982,
    1.04,
    1.09,
    1.15,
    1.20,
    1.25,
    1.31,
    1.36,
    1.42,
    1.47,
    1.53,
    1.58,
    1.64,
    1.69,
    1.75,
    1.80,
    1.86,
    1.91,
    1.97,
    2.02,
    2.07,
    2.13,
    2.18,
    2.24,
    2.29,
    2.35,
    2.40,
    2.46,
    2.51,
    2.57,
    2.62,
    2.67,
    2.73,
    3,
    3.27,
    3.55,
    3.82,
    4.09,
    4.37,
    4.64,
    4.91,
    5.18,
    5.46,
    6,
    6.55,
    7.09,
    7.64,
    8.19,
    8.73,
    9.28,
    9.82,
    10.4, //?
    10.9,
    13.6,
    16.4,
  ];

const PLATE_REVERB_TIME_VALUES = [
    0.520,
    0.694,
    0.867,
    1.04,
    1.21,
    1.39,
    1.56,
    1.73,
    1.91,
    2.08,
    2.25,
    2.43,
    2.60,
    2.77,
    2.95,
    3.12,
    3.30,
    3.47,
    3.64,
    3.82,
    3.99,
    4.16,
    4.34,
    4.51,
    4.68,
    4.86,
    5.03,
    5.20,
    5.38,
    5.55,
    5.72,
    5.90,
    6.07,
    6.24,
    6.42,
    6.59,
    6.76,
    6.94,
    7.11,
    7.28,
    7.46,
    7.63,
    7.80,
    7.98,
    8.15,
    8.32,
    8.50,
    8.67,
    9.54,
    10.4,
    11.3,
    12.1,
    13.0,
    13.9,
    14.7,
    15.6,
    16.5,
    17.3,
    19.1,
    20.8,
    22.5,
    24.3,
    26.0,
    27.7,
    29.5,
    31.2,
    32.9,
    34.7,
    43.3,
    52.0,
  ];

/*
  Reverb time range depends on room size and reverb type.
  There are always 70 possible values which depend on the maximum value for the
  combination of reverb type (hall, room, plate) and room size (1-10).
  There are 5 key indexes where the values is given: 0, 47, 57, 67, 69
  See also the graph in docs/reverb-time-example.png for a visualization.
  Between the key indexes, the values are linearly interpolated.
*/
const getReverbTime = (MAX, x) => {
  if (x < 0 || x > 69) {
      throw new Error("x is out of range: " + x);
  }

  const MIN = MAX / 100;
  const RANGE = MAX - MIN;
  // between special indexes, we linearly interpolate
  const KEY_INDEXES = [
    [0, MIN],
    [47, MIN + RANGE * 0.15832],
    [57, MIN + RANGE * 0.325952],
    [67, MIN + RANGE * 0.66395],
    [69, MAX],
  ];

  if (x === 0) {
    return KEY_INDEXES[0][1];
  }

  for (let i = 1; i < KEY_INDEXES.length; i++) {
    const previousKeyIndex = KEY_INDEXES[i - 1][0];
    const previousKeyValue = KEY_INDEXES[i - 1][1];

    const keyIndexEntry = KEY_INDEXES[i];
    const keyIndex = keyIndexEntry[0];
    const keyIndexValue = keyIndexEntry[1];
    if (x === keyIndex) {
      return keyIndexValue;
    } else if (x < keyIndex) {
      // linear interpolation between last and current key index
      const indexRange = keyIndex - previousKeyIndex;
      const xInRange = x - previousKeyIndex;
      const interpolationNormalized = xInRange / indexRange;
      const valueRange = keyIndexValue - previousKeyValue;
      const value = interpolationNormalized * valueRange + previousKeyValue;
      return value;
    } else {
      continue;
    }
  }
}

const ctx = document.getElementById('my-chart').getContext('2d');
const myChart = new Chart(ctx, {
    type: "scatter",
    data: {
        datasets: [
          {
            data: PLATE_REVERB_TIME_VALUES.map((e, i) => { return {x:i, y: e}}),
            label: 'Plate reverb actual',
            showLine: false,
            fill: false,
            borderColor: 'red'
          },
          {
            data: PLATE_REVERB_TIME_VALUES.map((e, i) => { return {x:i, y: getReverbTime(52, i)}}),
            label: 'Plate reverb interpolation',
            showLine: false,
            fill: false,
            borderColor: 'blue'
          },
        ]
    },
    options: {
        responsive: false,
        scales: {
            y: {
                beginAtZero: false
            }
        }
    }
});