---
title: Coroutine相关应用和理解
published: 2026-09-30
description: "有关coroutine的杂谈"
image: "2026-9-30-cover.jpg"
tags: [游戏, 开发, unity, coroutine]
category: 游戏开发
draft: false
---

在昨天的进度中推进了 `player_combo`（连击组）的开发，教程中用到了一个新东西 **Coroutine**（协程）。我竟然从来没有听说过，在听完那一讲之后我还是处于一种半懂不懂的状态，到今天才理清相关的逻辑和应用。

## 遇到的问题

```csharp title="Player_BasicAttackState.cs"
public override void Update()
{
    base.Update();
    HandleAttackVelocity();

    // 预输入判断：在 Update 中检查是否在这次攻击时按下攻击键，如果按下就加入队列准备进入下一次 AttackState，没有就进入 IdleState
    if (input.Player.Attack.WasPressedThisFrame())
        QueueNextAttack();

    if (triggerCalled)
        HandleStateExit();
}

private void HandleStateExit()
{
    if (comboAttackQueued)
    {
        anim.SetBool(animBoolName, false);
        player.EnterAttackStateWithDelay();
    }
    else
    {
        stateMachine.ChangeState(player.idleState);
    }
}
```

我的 `BasicAttackState` 原逻辑是在攻击动画结束后直接调用 `ChangeState(idleState)`。这样做会使每一次 Combo（三段动画）间有短暂的间隔。

为了改进这个问题、增强手感，我采用了**预输入**的方法来判断是否在上一次攻击动画期间再次键入攻击。如果有，就再做一次 `ChangeState(basicAttackState)`，根据逻辑就会播放第二段攻击动画。

但是，如果直接在 `if (triggerCalled)` 后面接 `ChangeState(basicAttackState)`，攻击动画会直接卡住。
原因是 `ChangeState` 中会先调用 `anim.SetBool(animBoolName, false);`，再调用 `anim.SetBool(animBoolName, true);`。这全是在**同一帧**（同一个 `Update()`）中调用的。因此，在这一帧结束时 Animator 来检查参数 `basicAttack` 时，它的值依然是 **true**，导致上一段动画没有成功退出，直接卡住。

> **注：** Animator 检查参数是在每一帧结束时进行的。

---

## 解决思路：引入 Coroutine

为了解决以上问题，我们需要引入 Coroutine。
**核心目的：** 在这一帧结束时（Animator 检查时）保持参数 `basicAttack` 为 false，保证动画能够正常退出，然后下半截再重新将其设置为 true。

这里我起初有一个没想通的点：如果 `Update()` 执行完就是一帧的话，代码执行到 `yield return new WaitForEndOfFrame();` 时就会卡住，这一帧就不会执行下去，这岂不是自相矛盾？

**事实是：** `yield return` 并不会卡住 `Update` 的执行。它会直接 return 并给 Unity 留言：“在这特定时机到来后，唤醒并执行我之后的代码”。然后 `Update` 就可以顺利结束，并在合适的时机再执行 `stateMachine.ChangeState(basicAttackState)`，完美解决问题。

```csharp title="Player.cs"
public void EnterAttackStateWithDelay()
{
    if (queuedAttackCo != null)
        StopCoroutine(queuedAttackCo);

    queuedAttackCo = StartCoroutine(EnterAttackStateWithDelayCo());
}

private IEnumerator EnterAttackStateWithDelayCo()
{
    yield return new WaitForEndOfFrame();
    stateMachine.ChangeState(basicAttackState);
}
```

### 帧渲染的真相
执行完 `Update()` **并不等于**跑完了一整帧。Unity 一帧所做的事情如下：

> **==================== 【第 100 帧 开始】 ====================**
> 
> **【工位 1：Update 阶段】**（跑你写的 C# 脚本）
> - 你的 `Update()` 开始执行。 
> - 你的 `Update()` 顺利结束！（注意：此时工位 1 下班了，但第 100 帧才刚开始！）
> 
> **【工位 2：Animator 动画结算阶段】**（Unity 内部接管，你看不见的代码）
> - Unity 的动画机过来检查参数（此时 `basicAttack` 为 false，动画顺利退出）。
> 
> **【工位 3：画面渲染阶段 (Render)】**
> - 显卡把当前这一帧的画面画到你的显示器上。
> 
> **【工位 4：帧末尾阶段 (EndOfFrame)】**
> - 画面都画完了，第 100 帧马上就要结束了！
> - Unity 唤醒协程的下半截，执行：`stateMachine.ChangeState(basicAttackState);`（此时参数重新变回 true，准备下一帧播放下一段连击）。
> 
> **==================== 【第 100 帧 彻底结束】 ====================**

---

## 什么是 Coroutine？

Coroutine（Cooperate Routine），中文叫**协程（协作式进程）**。它是一个可以中途退出，并在特定条件满足时再回来继续执行的函数。

它的底层逻辑是：在遇到 `yield return` 时直接 return，然后把当前跑到第几行、里面的局部变量是什么值，全都保存在内存里，接着退出这个函数去做其他事。到了约定的时间，再回到暂停的地方继续往下执行。

C# 中的协程本质上是利用**状态机**实现的。`yield return` 之前的内容是 State 0，之后的内容是 State 1。每次 Unity 唤醒协程的时候，都相当于做了一次状态的转换，从 State 0 推进到 State 1。

> **冷知识：** C# 语言本身并没有传统意义上的“协程”底层对象，它只有 `IEnumerator`（迭代器）和 `yield return` 关键字。`StartCoroutine` 和 `WaitForSeconds` 等调度机制是由 Unity 引擎自己封装提供的。另外，协程不是多线程，它依然运行在主线程上。

---

## Coroutine 的标准写法与用法大全

在 Unity 中写 Coroutine，建议遵循以下标准模板和分类：

### 1. 基础语法模板

```csharp
using System.Collections; // 1. 必须引入这个命名空间，否则找不到 IEnumerator
using UnityEngine;

public class Example : MonoBehaviour
{
    private Coroutine myCo; // 可选：用来存协程的“遥控器”，方便中途掐断它

    void Start()
    {
        // 2. 启动协程：必须用 StartCoroutine 包裹，可以像普通函数一样传参数
        myCo = StartCoroutine(MyCoroutineFunction(2.0f));
    }

    // 3. 定义协程：返回值必须是 IEnumerator，函数名习惯以 Co 或 Routine 结尾
    private IEnumerator MyCoroutineFunction(float waitTime)
    {
        Debug.Log("第一阶段：立刻执行");

        // 4. 核心暂停点：必须至少有一个 yield return
        yield return new WaitForSeconds(waitTime);

        Debug.Log("第二阶段：等了 " + waitTime + " 秒后才执行");
    }
}
```

### 2. 游戏开发最常用的 5 种 yield return（暂停指令）

在 `yield return` 后面跟不同的对象，就代表告诉 Unity “什么时候再叫醒我”。

| 写法 | 什么时候叫醒我？ | 银河恶魔城实战用途 |
| :--- | :--- | :--- |
| `yield return null;` | 下一帧的 `Update()` 跑完后立刻叫醒我（只等 1 帧） | 做平滑过渡（如背景音乐每帧音量减小一点、画面每帧变暗一点） |
| `yield return new WaitForEndOfFrame();` | 当前帧所有渲染和动画跑完、帧即将结束时 | 骗过 Animator 同帧盲区（如连击代码中的应用）、截屏功能 |
| `yield return new WaitForSeconds(0.5f);` | 等待 0.5 秒游戏时间后叫醒我（受时间缩放影响）| 技能冷却、角色受击后无敌闪烁 0.5 秒、Boss 蓄力前摇 |
| `yield return new WaitForSecondsRealtime(0.1f);`| 等待 0.1 秒现实世界时间后（无视游戏暂停/慢动作）| 大招动画特写、受击顿帧 Hitstop（将游戏时间设为0时，靠它恢复） |
| `yield return new WaitUntil(() => groundDetected);` | 一直暂停，直到括号里的条件变成 `true` | Boss 跳到空中，一直等到“落地”的那一帧，立刻震地放冲击波 |

### 3. Update 计时器 vs Coroutine 怎么选？

*   **选 Update 计时器（`timer -= Time.deltaTime`）：**
    当你需要在计时过程中**每一帧都做动态调整**，或者这个计时跟当前状态（State）高度绑定、状态一退出计时就作废时。

*   **选 Coroutine（协程）：**
    当你只需要做**“分步演出”**或**“延时触发一次”**时（比如：变白 -> 等 0.1 秒 -> 变回原色）。如果这种单次延时的琐事也去 Update 里写计时器，你的 `Player.cs` 里很快就会塞满几十个 `flashTimer`、`dashTimer`、`stunTimer`，代码会乱成一锅粥。