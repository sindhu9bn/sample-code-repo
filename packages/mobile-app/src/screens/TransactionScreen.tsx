// packages/mobile-app/src/screens/TransactionScreen.tsx
// React Native screen showing transaction history with pull-to-refresh.

import React, { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useTransactions } from "@finpay/shared/hooks/useTransactions";
import { formatCurrency } from "@finpay/shared/utils/currency";
import { Transaction } from "@finpay/shared/types";

interface TransactionScreenProps {
  route: {
    params: { accountId: string };
  };
  navigation: any;
}

/**
 * BUG 32 (PERFORMANCE - React Native): No getItemLayout on FlatList.
 * Without getItemLayout, FlatList cannot pre-calculate scroll positions,
 * making scrollToIndex and initial scroll offset unreliable.
 * For fixed-height items (which these are), always provide getItemLayout.
 *
 * BUG 33 (PERFORMANCE): renderItem not memoised with useCallback.
 * FlatList re-renders all visible items whenever parent re-renders.
 * renderItem should be wrapped in useCallback and TransactionItem
 * should be wrapped in React.memo.
 */
export function TransactionScreen({ route, navigation }: TransactionScreenProps) {
  const { accountId } = route.params;
  const { transactions, isLoading, hasMore, loadMore, refresh } =
    useTransactions(accountId);

  // BUG 33: Not memoised
  const renderItem = ({ item }: { item: Transaction }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate("TransactionDetail", { transactionId: item.id })}
    >
      <View style={styles.itemLeft}>
        <Text style={styles.description} numberOfLines={1}>
          {item.description}
        </Text>
        <Text style={styles.date}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.itemRight}>
        {/* BUG 34 (MEDIUM): Status colours hardcoded as strings.
            If status values change in the API, styles silently break.
            Should use a mapping object from TransactionStatus type. */}
        <Text
          style={[
            styles.amount,
            item.status === "failed" && styles.failed,
            item.status === "completed" && styles.completed,
          ]}
        >
          {formatCurrency(item.amount)}
        </Text>
        <Text style={styles.status}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  /**
   * BUG 35 (MEDIUM - React Native): onEndReached fires too aggressively.
   * onEndReachedThreshold={0.5} means loadMore fires when user is
   * halfway through the list — way too early.
   * Should be 0.1 (near the bottom) to avoid premature fetches.
   */
  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        renderItem={renderItem} // BUG 33: not memoised
        keyExtractor={(item) => item.id}
        // BUG 32: Missing getItemLayout
        onEndReached={loadMore}
        onEndReachedThreshold={0.5} // BUG 35: too aggressive
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <Text style={styles.empty}>No transactions yet.</Text>
          )
        }
        ListFooterComponent={
          hasMore ? (
            <Text style={styles.loadingMore}>Loading more...</Text>
          ) : null
        }
        contentContainerStyle={transactions.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

const ITEM_HEIGHT = 72; // used if we add getItemLayout

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    height: ITEM_HEIGHT,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  itemLeft: { flex: 1, marginRight: 16 },
  itemRight: { alignItems: "flex-end" },
  description: { fontSize: 15, color: "#1a1a2e", fontWeight: "500" },
  date: { fontSize: 12, color: "#999", marginTop: 4 },
  amount: { fontSize: 16, fontWeight: "bold", color: "#333" },
  failed: { color: "#e74c3c" },
  completed: { color: "#27ae60" },
  status: { fontSize: 11, color: "#999", marginTop: 2, textTransform: "capitalize" },
  empty: { textAlign: "center", color: "#999", marginTop: 48, fontSize: 16 },
  emptyContainer: { flex: 1, justifyContent: "center" },
  loadingMore: { textAlign: "center", padding: 16, color: "#999" },
});
