# KeystrokeDynamics
A customisable authentication system based on keystroke biometrics, with a visualisation dashboard.

- [KeystrokeDynamics](#keystrokedynamics)
  - [Screenshots](#screenshots)
  - [Introduction](#introduction)
  - [How does it work?](#how-does-it-work)
    - [Keystroke features](#keystroke-features)
  - [The detectors](#the-detectors)
    - [Manhattan (Individual)](#manhattan-individual)
    - [Manhattan Filtered (Individual)](#manhattan-filtered-individual)
    - [Manhattan (Population)](#manhattan-population)
    - [Manhattan Filtered (Population)](#manhattan-filtered-population)
    - [Mahalanobis](#mahalanobis)
  - [Tech Stack](#tech-stack)

---

## Screenshots
![Screenshot 1](./screenshots/Screenshot%201.png)
![Screenshot 2](./screenshots/Screenshot%202.png)

---

## Introduction
Keystroke Dynamics or Biometrics is the manner and rhythm in which an individual types characters on a keyboard. These details are used to develop a unique biometric template of the user's typing pattern for future authentication.

## How does it work?
- A basic keystroke logger implemented in [`keystrokeLogger.js`](./frontend/js/keystrokeLogger.js) and used in the forms
- Keystroke timings are recorded and sent to the server along with threshold details
- Server processes input and checks it against the data in the DB

### Keystroke features
- Hold time (keydown-keyup)
- Flight time (keyup-keydown)
- DD time (keydown-keydown)

---

## The detectors
### Manhattan (Individual)
- Uses Manhattan distance between the mean and the input of each feature
- Allowed range is `mean ± multiplier * SD`
- If a certain percentage of input features fall in this range, the attempt is accepted
- Most effective when dealing with a small amount of data in the DB (<5 attempts) at default thresholds
- User controls:
  - SD Multiplier
  - Acceptance percentage

### Manhattan Filtered (Individual)
- Same as the Manhattan detector, but with the outliers filtered out
- Allowed data is in the range `mean ± 2.5 * SD`
- Allows for a stricter dataset to compare against. Effective with >5 entries in the database at default thresholds
- User controls:
  - SD Multiplier
  - Acceptance percentage

### Manhattan (Population)
- Uses Manhattan distance between the mean vector and the input vector
- Responds to minor deviations in input patterns
- Default thresholds are very strict
- Works well a decent amount of data (<10 attempts)
- User Controls
  - Distance threshold

### Manhattan Filtered (Population)
- Same as the Manhattan detector, but with the outliers filtered out
- Responds to minor deviations in input patterns
- Default thresholds are very strict
- Works well a decent amount of data (<10 attempts)
- User Controls
  - Distance threshold

### Mahalanobis
- Uses the Mahalanobis distance between the mean and input vectors
- Quite sensitive to deviations in input patterns
- Default thresholds are not too strict
- Can be used in combination with the Manhattan detectors for a precise decision
- User Controls
  - Distance threshold

---

## Tech Stack
- Node.JS
- MongoDB
- HTML
- CSS ([halfmoon](https://www.gethalfmoon.com/))
- JS
