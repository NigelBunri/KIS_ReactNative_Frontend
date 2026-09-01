// src/components/partners/PartnerBudgetTrackingPanel.tsx
//
// Budget Tracking: admins allocate a budget (optionally per department)
// and record real expenses against it. Backed by
// apps.partners.PartnerBudget/PartnerBudgetExpense — spent/remaining/
// percent-used are always computed server-side from recorded expenses,
// never a projection.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type Budget = {
  id: string | number;
  name: string;
  allocated_amount: string | number;
  currency: string;
  department_name?: string | null;
  spent_amount: string | number;
  remaining_amount: string | number;
  percent_used: number;
};
type Expense = { id: string | number; description: string; amount: string | number; spent_at: string; recorded_by_name?: string | null };
type Department = { id: string | number; name: string };

const inputStyle = (palette: any) => ({
  color: palette.text,
  borderColor: palette.borderMuted,
  borderWidth: 2,
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 10,
  marginTop: 8,
});

function ProgressBar({ percent, palette }: { percent: number; palette: any }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const over = percent > 100;
  return (
    <View style={{ height: 6, borderRadius: 999, backgroundColor: palette.borderMuted, overflow: 'hidden', marginTop: 6 }}>
      <View style={{ height: '100%', width: `${clamped}%`, borderRadius: 999, backgroundColor: over ? palette.danger : palette.primary }} />
    </View>
  );
}

export default function PartnerBudgetTrackingPanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState<string | null>(null);

  const [selectedBudgetId, setSelectedBudgetId] = useState<string | number | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  const backdropOpacity = panelTranslateX.interpolate({ inputRange: [0, panelWidth], outputRange: [1, 0], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    if (!partnerId) return;
    const [budgetRes, deptRes] = await Promise.all([
      getRequest(ROUTES.partners.budgets(partnerId), { errorMessage: 'Unable to load budgets.' }),
      getRequest(ROUTES.partners.departments(partnerId), { errorMessage: 'Unable to load departments.' }),
    ]);
    const budgetPayload = budgetRes?.data ?? [];
    setBudgets(Array.isArray(budgetPayload) ? budgetPayload : []);
    const deptPayload = deptRes?.data ?? [];
    setDepartments(Array.isArray(deptPayload) ? deptPayload : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const selectedBudget = budgets.find((b) => String(b.id) === String(selectedBudgetId)) ?? null;

  const loadExpenses = useCallback(
    async (budgetId: string | number) => {
      if (!partnerId) return;
      setExpensesLoading(true);
      const res = await getRequest(ROUTES.partners.budgetExpenses(partnerId, String(budgetId)), { errorMessage: 'Unable to load expenses.' });
      const payload = (res?.data ?? []) as Expense[];
      setExpenses(Array.isArray(payload) ? payload : []);
      setExpensesLoading(false);
    },
    [partnerId],
  );

  const openBudget = (budget: Budget) => {
    setSelectedBudgetId(budget.id);
    loadExpenses(budget.id);
  };

  const createBudget = async () => {
    if (!partnerId || !newName.trim() || !newAmount.trim()) {
      Alert.alert('Missing info', 'Name and allocated amount are required.');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.budgets(partnerId),
      { name: newName.trim(), allocated_amount: newAmount.trim(), department: newDepartmentId },
      { errorMessage: 'Unable to create budget.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to create budget.');
      return;
    }
    setNewName('');
    setNewAmount('');
    setNewDepartmentId(null);
    setShowCreate(false);
    load();
  };

  const deleteBudget = (budget: Budget) => {
    if (!partnerId) return;
    Alert.alert('Delete budget?', `"${budget.name}" and all its expenses will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deleteRequest } = await import('@/network/delete');
          const res = await deleteRequest(ROUTES.partners.budgetDetail(partnerId, String(budget.id)), {
            errorMessage: 'Unable to delete budget.',
          });
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to delete budget.');
            return;
          }
          setSelectedBudgetId(null);
          load();
        },
      },
    ]);
  };

  const addExpense = async () => {
    if (!partnerId || !selectedBudget || !expenseDescription.trim() || !expenseAmount.trim()) {
      Alert.alert('Missing info', 'Description and amount are required.');
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.budgetExpenses(partnerId, String(selectedBudget.id)),
      { description: expenseDescription.trim(), amount: expenseAmount.trim() },
      { errorMessage: 'Unable to record expense.' },
    );
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to record expense.');
      return;
    }
    setExpenseDescription('');
    setExpenseAmount('');
    loadExpenses(selectedBudget.id);
    load();
  };

  const deleteExpense = (expense: Expense) => {
    if (!partnerId || !selectedBudget) return;
    Alert.alert('Delete expense?', `"${expense.description}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deleteRequest } = await import('@/network/delete');
          const res = await deleteRequest(
            ROUTES.partners.budgetExpenseDetail(partnerId, String(selectedBudget.id), String(expense.id)),
            { errorMessage: 'Unable to delete expense.' },
          );
          if (!res?.success) {
            Alert.alert('Failed', res?.message ?? 'Unable to delete expense.');
            return;
          }
          loadExpenses(selectedBudget.id);
          load();
        },
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.settingsPanelBackdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          { width: panelWidth, backgroundColor: palette.surfaceElevated, borderLeftColor: palette.divider, transform: [{ translateX: panelTranslateX }] },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable
            onPress={() => (selectedBudgetId ? setSelectedBudgetId(null) : onClose())}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              {selectedBudget ? selectedBudget.name : 'Budget Tracking'}
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              {selectedBudget ? `${selectedBudget.currency} ${selectedBudget.spent_amount} of ${selectedBudget.allocated_amount} spent` : 'Track budgets by department'}
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsPanelBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : selectedBudget ? (
            <>
              <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 16 }]}>
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>
                  {selectedBudget.percent_used}% used
                  {selectedBudget.department_name ? ` · ${selectedBudget.department_name}` : ''}
                </Text>
                <ProgressBar percent={selectedBudget.percent_used} palette={palette} />
                <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 6 }}>
                  Remaining: {selectedBudget.currency} {selectedBudget.remaining_amount}
                </Text>
              </View>

              <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>Record an expense</Text>
              <TextInput value={expenseDescription} onChangeText={setExpenseDescription} placeholder="Description" placeholderTextColor={palette.subtext} style={[inputStyle(palette), { marginTop: 0 }]} />
              <TextInput value={expenseAmount} onChangeText={setExpenseAmount} placeholder="Amount" placeholderTextColor={palette.subtext} keyboardType="decimal-pad" style={inputStyle(palette)} />
              <Pressable
                onPress={addExpense}
                disabled={saving}
                style={({ pressed }) => [{ marginTop: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1, marginBottom: 20 }]}
              >
                <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Recording…' : 'Record expense'}</Text>
              </Pressable>

              <Text style={{ color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
                Expenses ({expenses.length})
              </Text>
              {expensesLoading ? (
                <ActivityIndicator size="small" color={palette.primary} />
              ) : expenses.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 20 }}>No expenses recorded yet.</Text>
              ) : (
                expenses.map((expense) => (
                  <View key={expense.id} style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{expense.description}</Text>
                      <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>{selectedBudget.currency} {expense.amount}</Text>
                    </View>
                    <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>{expense.spent_at}{expense.recorded_by_name ? ` · ${expense.recorded_by_name}` : ''}</Text>
                    <Pressable onPress={() => deleteExpense(expense)} style={{ marginTop: 6 }}>
                      <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700' }}>Delete</Text>
                    </Pressable>
                  </View>
                ))
              )}
              <Pressable onPress={() => deleteBudget(selectedBudget)} style={{ marginTop: 12 }}>
                <Text style={{ color: palette.danger, fontSize: 13, fontWeight: '700' }}>Delete budget</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={() => setShowCreate((v) => !v)}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '700', marginBottom: showCreate ? 8 : 12 }}>
                  {showCreate ? '− Cancel new budget' : '+ New budget'}
                </Text>
              </Pressable>
              {showCreate ? (
                <View style={{ marginBottom: 16 }}>
                  <TextInput value={newName} onChangeText={setNewName} placeholder="Budget name" placeholderTextColor={palette.subtext} style={[inputStyle(palette), { marginTop: 0 }]} />
                  <TextInput value={newAmount} onChangeText={setNewAmount} placeholder="Allocated amount" placeholderTextColor={palette.subtext} keyboardType="decimal-pad" style={inputStyle(palette)} />
                  <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 10, marginBottom: 4 }}>Department (optional)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {departments.map((dep) => {
                      const selected = newDepartmentId === String(dep.id);
                      return (
                        <Pressable
                          key={dep.id}
                          onPress={() => setNewDepartmentId(selected ? null : String(dep.id))}
                          style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: selected ? palette.primary : palette.borderMuted }}
                        >
                          <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 12 }}>{dep.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    onPress={createBudget}
                    disabled={saving}
                    style={({ pressed }) => [{ marginTop: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.royalInk, alignItems: 'center', opacity: pressed || saving ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: palette.ivory, fontWeight: '700' }}>{saving ? 'Creating…' : 'Create budget'}</Text>
                  </Pressable>
                </View>
              ) : null}

              {budgets.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginTop: 20 }}>No budgets yet.</Text>
              ) : (
                budgets.map((budget) => (
                  <Pressable
                    key={budget.id}
                    onPress={() => openBudget(budget)}
                    style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginBottom: 8 }]}
                  >
                    <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>{budget.name}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                      {budget.department_name ? `${budget.department_name} · ` : ''}
                      {budget.currency} {budget.spent_amount} / {budget.allocated_amount}
                    </Text>
                    <ProgressBar percent={budget.percent_used} palette={palette} />
                  </Pressable>
                ))
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
