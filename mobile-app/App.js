import 'react-native-gesture-handler';
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { COLORS } from './src/theme';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PurchaseScreen from './src/screens/PurchaseScreen';
import QRPrintScreen from './src/screens/QRPrintScreen';
import StockListScreen from './src/screens/StockListScreen';
import DealerMasterScreen from './src/screens/DealerMasterScreen';
import ScanVerifyScreen from './src/screens/ScanVerifyScreen';
import DeliveryStatementScreen from './src/screens/DeliveryStatementScreen';
import ProductHistoryScreen from './src/screens/ProductHistoryScreen';
import AssignedOrdersScreen from './src/screens/AssignedOrdersScreen';
import MobileStockPickingScreen from './src/screens/MobileStockPickingScreen';
import DealerApprovalStatusScreen from './src/screens/DealerApprovalStatusScreen';

const Stack = createStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: COLORS.primary },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: 'bold', fontSize: 16 }
};

function Splash() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color="#FFFFFF" />
      <Text style={styles.splashText}>VANIKI STOCK TRACE</Text>
    </View>
  );
}

// Auth state decides which stack exists, so there is no manual replace/reset:
// signing out unmounts the app screens, signing in unmounts the login screen.
function RootNavigator() {
  const { user, booting } = useAuth();

  if (booting) return <Splash />;

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Vaniki Warehouse' }} />
          <Stack.Screen name="Purchase" component={PurchaseScreen} options={{ title: 'Purchase Entry & Intake' }} />
          <Stack.Screen name="QRPrint" component={QRPrintScreen} options={{ title: 'QR Label Printing' }} />
          <Stack.Screen name="StockList" component={StockListScreen} options={{ title: 'Stock Inventory' }} />
          <Stack.Screen name="AssignedOrders" component={AssignedOrdersScreen} options={{ title: 'Assigned Bills' }} />
          <Stack.Screen name="StockPicking" component={MobileStockPickingScreen} options={{ title: 'Stock Picking' }} />
          <Stack.Screen name="ScanVerify" component={ScanVerifyScreen} options={{ title: 'Dispatch Scan Verify' }} />
          <Stack.Screen name="DealerMaster" component={DealerMasterScreen} options={{ title: 'Dealer Directory' }} />
          <Stack.Screen name="DeliveryStatement" component={DeliveryStatementScreen} options={{ title: 'Delivery Statements' }} />
          <Stack.Screen name="DealerApprovalStatus" component={DealerApprovalStatusScreen} options={{ title: 'Dealer Approval & Bilty' }} />
          <Stack.Screen name="ProductHistory" component={ProductHistoryScreen} options={{ title: 'Product Lifecycle' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  splashText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14, letterSpacing: 1, marginTop: 14 }
});
