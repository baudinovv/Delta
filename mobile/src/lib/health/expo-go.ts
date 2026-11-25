import Constants, { ExecutionEnvironment } from 'expo-constants';

/** Expo Go ships without HealthKit / Health Connect native code. */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
