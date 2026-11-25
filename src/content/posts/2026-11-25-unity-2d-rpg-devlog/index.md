---
title: Unity 2D RPG 架构演进与开发日志
published: 2026-11-25
updated: 2026-11-25
description: "记录 Unity 2D RPG 项目从战斗状态、数值管道到技能系统的核心因果链与架构设计笔记。"
tags: [Unity, C#, 2D RPG, 架构设计, 开发日志]
category: 游戏开发
draft: false
---

> 本日志持续更新，记录 Unity 2D RPG 项目每节核心机制的**底层设计思想**与**全局因果时序图**（最新进度在最上方）。

---

## 2026-11-25 · 技能数据（Skill_DataSO 与 OnValidate 自动化）

> **核心思想**：用 `OnValidate()` 把数据资产（ScriptableObject）的变更实时投影到编辑器视口中，实现零运行成本的所见即所得（WYSIWYG）工作流。

```mermaid
sequenceDiagram
    autonumber
    actor Dev as 开发者 (Unity Editor)
    participant SO as 资产: Skill_DataSO (.asset)
    participant Node as 节点脚本: UI_TreeNode
    participant Img as 子物体: Image (skillIcon)
    participant Hierarchy as Unity 层级面板 (GameObject)

    Dev->>SO: 1. CreateAssetMenu 创建技能数据资产 (如 Time Echo)
    Dev->>Node: 2. 将 SO 拖拽赋值给 Inspector 的 skillData 字段
    Note over Dev,Node: 编辑器检测到序列化字段变动，自动触发 OnValidate()
    Node->>Node: 3. 判空校验: if (skillData == null) return
    Node->>SO: 4. 读取 displayName 与 icon
    Node->>Node: 5. 同步 skillName = skillData.displayName
    Node->>Img: 6. 自动替换图标 skillIcon.sprite = skillData.icon
    Node->>Hierarchy: 7. 自动重命名物体为 "UI TreeNode - Time Echo"
```

---

## 2026-11-24 · 技能树节点 UI（UI_TreeNode 与 EventSystems）

> **核心思想**：以状态为核心的视觉驱动（State-Driven Visual），用 `IPointerEnter/Exit/Down` 接口契约替代臃肿的普通 Button 组件。

```mermaid
sequenceDiagram
    autonumber
    actor Mouse as 玩家鼠标
    participant EventSys as Unity EventSystem (Raycaster)
    participant Node as UI_TreeNode
    participant Img as UI Image (skillIcon)
    participant FutureMgr as [后续对接] Player_SkillManager

    Note over Node,Img: 初始化: Awake -> 设置置灰颜色 (#9F9797)

    rect rgb(240, 248, 255)
    Note over Mouse,Img: 交互阶段 1：悬停探测 (IPointerEnter / Exit)
    Mouse->>EventSys: 鼠标光标移入节点范围
    EventSys->>Node: 触发 OnPointerEnter(eventData)
    Node->>Node: 检查 isUnlocked == false
    Node->>Img: UpdateIconColor(微亮高亮 Color.white * 0.9f)
    
    Mouse->>EventSys: 鼠标移出节点范围
    EventSys->>Node: 触发 OnPointerExit(eventData)
    Node->>Img: UpdateIconColor(恢复上次的颜色 lastColor)
    end

    rect rgb(255, 250, 240)
    Note over Mouse,FutureMgr: 交互阶段 2：点击解锁 (IPointerDown)
    Mouse->>EventSys: 鼠标左键点击节点
    EventSys->>Node: 触发 OnPointerDown(eventData)
    Node->>Node: CanBeUnlocked 校验 (未解锁 且 未被上锁)
    alt 条件不满足 (已解锁或被锁死)
        Node-->>Mouse: 拒绝解锁
    else 满足解锁条件
        Node->>Node: Unlock() -> isUnlocked = true
        Node->>Img: UpdateIconColor(常驻白光 Color.white)
        Node->>FutureMgr: 通知 SkillManager 激活对应技能逻辑
    end
    end
```

---

## 2026-11-23 · StatSystem 完结：ScriptableObject 数据驱动预设

> **核心思想**：逻辑写在组件里，数据落在资产（SO）上；用数据驱动代替手动配参，用 `[ContextMenu]` 右键菜单工具提升研发管线效率。

```mermaid
sequenceDiagram
    autonumber
    actor Dev as 策划/开发者
    participant SO as 数据配置单: Stat_SetupSO (.asset)
    participant EntityStats as 实体属性网关: Entity_Stats
    participant StatObj as 具体属性: Stat (如 maxHealth)

    Dev->>SO: 1. 创建独立资产配置 (如 Skeleton.asset / Player.asset)
    Dev->>EntityStats: 2. 将 SO 拖拽挂载到 Inspector 的 defaultStatSetup
    Dev->>EntityStats: 3. 右键点击组件菜单 [ContextMenu: ApplyDefaultStatSetup]
    EntityStats->>EntityStats: 4. 校验 defaultStatSetup != null
    
    rect rgb(240, 248, 255)
    Note over EntityStats,StatObj: 批量属性刷入 (SetBaseValue)
    EntityStats->>StatObj: 5. resources.maxHealth.SetBaseValue(SO.maxHealth)
    EntityStats->>StatObj: 6. offense.damage.SetBaseValue(SO.damage)
    EntityStats->>StatObj: 7. ...遍历四大属性组灌注基础数值
    end
```

---

## 2026-11-22 · 状态修正系统与可互动增益对象（Stat Modifiers & Object Buff）

> **核心思想**：修饰符列表实现数值可逆，脏标记（Dirty Flag）杜绝重复计算；道具隐身充当计时沙漏，用完自毁不留垃圾。

```mermaid
sequenceDiagram
    autonumber
    actor Player as 玩家 (带 Collider2D)
    participant BuffObj as 场景道具: Object_Buff
    participant Stats as 实体属性: Entity_Stats
    participant StatObj as 具体属性: Stat (如 Damage)

    Player->>BuffObj: 1. 触发 OnTriggerEnter2D
    BuffObj->>BuffObj: 2. canBeUsed 校验防重入
    BuffObj->>BuffObj: 3. 启动协程 BuffCoroutine(duration)
    BuffObj->>BuffObj: 4. sr.color = Color.clear (视觉隐形伪装被吃)
    
    rect rgb(240, 248, 255)
    Note over BuffObj,StatObj: 步骤 A：注入状态修正 (ApplyBuff: true)
    BuffObj->>Stats: 5. GetStatByType(buff.type)
    Stats-->>BuffObj: 路由并返回具体的 Stat 实例
    BuffObj->>StatObj: 6. AddModifier(value, buffName)
    StatObj->>StatObj: 7. 存入 List<StatModifier>，标记 needToRecalculate = true (立脏标记)
    end

    rect rgb(255, 250, 240)
    Note over Player,StatObj: 步骤 B：按需惰性求值 (Lazy Evaluation)
    Player->>StatObj: 8. 玩家挥刀调用 GetValue()
    StatObj->>StatObj: 9. 发现脏标记为 true -> 遍历 Modifier 计算 baseValue + 修正值
    StatObj->>StatObj: 10. 缓存 finalValue，重置 needToRecalculate = false
    StatObj-->>Player: 返回最新强化后的数值
    end

    rect rgb(255, 240, 245)
    Note over BuffObj,StatObj: 步骤 C：到期卸载与清理 (ApplyBuff: false)
    Note over BuffObj: 11. yield return new WaitForSeconds(duration) 倒计时结束
    BuffObj->>StatObj: 12. RemoveModifier(buffName) (通过名称精准剔除)
    StatObj->>StatObj: 13. 再次立脏标记 needToRecalculate = true
    BuffObj->>BuffObj: 14. Destroy(gameObject) 彻底销毁道具自身
    end
```

---

## 2026-11-18 · 生命回复与攻击速度同步（Health Regen & Attack Speed）

> **核心思想**：以动画速度为唯一真理，将手感节奏全权委托给帧事件；只改动画机播放速率，命中判定与收招硬直自然等比例压缩。

```mermaid
sequenceDiagram
    autonumber
    actor Player as 玩家输入
    participant State as Player_BasicAttackState
    participant BaseState as EntityState
    participant Stats as Entity_Stats (offense)
    participant Anim as Unity Animator
    participant Combat as Entity_Combat (Animation Trigger)

    Player->>State: 1. 按下普通攻击
    State->>State: 2. Enter() 进入攻击状态
    State->>BaseState: 3. 调用 SyncAttackSpeed()
    BaseState->>Stats: 4. 读取 offense.attackSpeed.GetValue()
    Stats-->>BaseState: 返回攻速数值 (如 1.5f)
    BaseState->>Anim: 5. SetFloat("attackSpeedMultiplier", 1.5f)
    Note over Anim: 6. Animator 检测到 Speed Parameter<br/>攻击动画以 1.5 倍速播放
    Anim->>Combat: 7. 动画帧事件提早触发：AnimationTrigger()<br/>(命中检测与伤害结算更快到来)
    Anim->>State: 8. 动画结束帧提早触发：AnimationFinishTrigger()<br/>(提前解除硬直，切回移动或连招)
```

---

## 2026-11-18 · 电击状态效果（Electrify / Lightning）

> **核心思想**：连续施压刷新窗口，蓄力爆发一次结清——用协程生命周期管理实现防抖与时间刷新，用累积阈值模式将多次小攻击转化为爆发雷罚。

```mermaid
sequenceDiagram
    autonumber
    participant AttackerCombat as 攻击方: Entity_Combat
    participant TargetStats as 受击方: Entity_Stats
    participant TargetHandler as 受击方: Entity_StatusHandler
    participant TargetVFX as 受击方: Entity_VFX
    participant TargetHealth as 受击方: Entity_Health

    AttackerCombat->>TargetHandler: 1. ApplyStatusEffect(Lightning) 尝试上雷属性
    TargetHandler->>TargetHandler: 2. CanBeApplied: 检查自身（无状态 或 已是电击可充能）
    TargetHandler->>TargetStats: 3. GetElementalResistance(Lightning) 查雷抗性
    TargetStats-->>TargetHandler: 返回抗性，折算出 finalCharge
    TargetHandler->>TargetHandler: 4. currentCharge += finalCharge (累加电荷)

    alt 电荷未满 (currentCharge < maximumCharge)
        TargetHandler->>TargetHandler: 5a. StopCoroutine (若已有旧倒计时则打断)
        TargetHandler->>TargetHandler: 6a. StartCoroutine(ElectrifyEffectCo) 重新计时
        TargetHandler->>TargetVFX: 7a. PlayOnStatusVfx (维持黄光闪烁)
    else 电荷蓄满 (currentCharge >= maximumCharge)
        TargetHandler->>TargetHandler: 5b. DoLightningStrike(damage) 触发雷罚
        TargetHandler->>TargetHealth: 6b. ReduceHp(damage) 扣除巨额爆发血量
        TargetHandler->>TargetHandler: 7b. Instantiate 落雷特效
        TargetHandler->>TargetHandler: 8b. StopElectrifyEffect 清零电荷 & 恢复状态
    end
```
