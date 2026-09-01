import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

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

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: '#0F6E56' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 16 }
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Vaniki Warehouse App' }} />
        <Stack.Screen name="Purchase" component={PurchaseScreen} options={{ title: 'Purchase Entry & Intake' }} />
        <Stack.Screen name="QRPrint" component={QRPrintScreen} options={{ title: 'QR Label Print Studio' }} />
        <Stack.Screen name="StockList" component={StockListScreen} options={{ title: 'Stock Inventory Matrix' }} />
        <Stack.Screen name="AssignedOrders" component={AssignedOrdersScreen} options={{ title: 'Assigned Bills & Stock Picking' }} />
        <Stack.Screen name="StockPicking" component={MobileStockPickingScreen} options={{ title: 'Scan Picking & Match' }} />
        <Stack.Screen name="DealerMaster" component={DealerMasterScreen} options={{ title: 'Dealer Directory (View Only)' }} />
        <Stack.Screen name="ScanVerify" component={ScanVerifyScreen} options={{ title: 'Initial & Dispatch Scan Guard' }} />
        <Stack.Screen name="DeliveryStatement" component={DeliveryStatementScreen} options={{ title: 'Delivery Statements' }} />
        <Stack.Screen name="DealerApprovalStatus" component={DealerApprovalStatusScreen} options={{ title: 'Dealer Approval & Bilty Tracker' }} />
        <Stack.Screen name="ProductHistory" component={ProductHistoryScreen} options={{ title: 'Product Lifecycle Trace' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
