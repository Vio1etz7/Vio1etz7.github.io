---
title: 委托/事件和订阅的理解和应用
published: 2026-10-21
description: "关于委托，事件的一些理解和static的理解"
image: ""
tags: [游戏, 开发, C#, unity, Event, Delegate, Subscribe, Unsubscribe]
category: 游戏开发
draft: false
---

> 最近的课程和 Unity 开发教程中都提到了事件/委托和订阅的相关知识，我对于这些知识比较薄弱，于是写了这篇文章来记录对于事件(event)/委托(delegate)和订阅(subscribe)的理解。

---

## 一、 委托（Delegate）的核心理解

**委托 = 一个能装方法的变量。**
普通变量装数字、文字、物体；委托这种变量装的是方法。

标准流程分为**四步**：
> **声明形状 $\rightarrow$ 造盒子（声明变量） $\rightarrow$ 挂载 $\rightarrow$ 调用**

### 1. 第一步与第二步：声明形状与造变量
* **第一步声明形状**：可以理解为**创造一种新的数据类型**，用于声明变量（类比 `class` 和 `struct`）。
  * **语法含义**：用 `delegate` 关键字定制一个规则——“必须是一个无参数、无返回值（void）的方法”。这叫定义形状。
* **第二步**：即用这个新数据类型声明一个变量。

```csharp
// 第一步：定义一个「形状」
public delegate void OnHit();
// 无参数、无返回值，这就是形状

// 第二步：按这个形状造一个变量
public class Enemy : MonoBehaviour
{
    OnHit onHit;
    // 此刻盒子里是空的
    void Start()
    {
        Debug.Log(onHit == null);
        // 出：True —— 空盒子
    }
}
```

### 2. 第三步：挂载（订阅与取消订阅）
订阅（`+=`），也可以取消订阅（`-=`）—— **注意：必须成对出现！**

```csharp
public class Enemy : MonoBehaviour
{
    OnHit onHit;
    void Start()
    {
        onHit += PlaySound;
        onHit += ShakeScreen;
        onHit -= PlaySound;
    }
    void PlaySound() { }
    void ShakeScreen() { }
}
```

### 3. 第四步：调用
```csharp
public class Enemy : MonoBehaviour
{
    protected int hp = 20;
    public OnHit onHit; // 盒子里挂着谁，这里看不见
    void Hurt()
    {
        hp = hp - 5;
        if (hp <= 0 && onHit != null) onHit(); // 这一下，里面全跑
    }
}
```

---

## 二、 事件（Event）：谁能触发的权限控制

以上是委托，接下来是**事件**。

> **事件与委托的唯一区别是谁能触发。**
> 事件只有**发布方**（谁声明这个事件谁就是发布方）能够触发！

### 1. 发布方
声明事件，自己决定什么时候触发：

```csharp
// 发布方：声明事件，自己决定什么时候触发
public class Enemy : MonoBehaviour
{
    public delegate void DeathHandler();
    public event DeathHandler OnDeath;  // 加了一个 event
    protected int hp = 20;
    void Hurt()
    {
        hp = hp - 5;
        if (hp <= 0) OnDeath();
    }
}
```

### 2. 订阅方
挂上去，等着被叫：

```csharp
// 订阅方：挂上去，等着被叫
public class ScoreBoard : MonoBehaviour
{
    public Enemy enemy;
    void Start()
    {
        enemy.OnDeath += AddScore;
    }
    public void AddScore() => Debug.Log("加分");
}
```

---

## 三、 实战应用：游戏开发教程中的事件与订阅

以上是课程发的实验手册上的讲解和例子，接下来我又在游戏开发教程中遇到了事件与订阅，如下：

* **业务逻辑**：为了让敌人在玩家死亡后检测不到玩家，由玩家发布事件 `OnPlayerDeath`，并由 `Enemy` 来订阅并切换到 `enemy.idleState`。

### 1. 玩家端与敌人的代码实现

```csharp title="Player.cs"
public static event Action OnPlayerDeath;

public override void EntityDeath()
{
    base.EntityDeath();
    OnPlayerDeath?.Invoke();
    stateMachine.ChangeState(deadState);
}
```

```csharp title="Enemy.cs"
private void HandlePlayerDeath()
{
    stateMachine.ChangeState(idleState);
}

private void OnEnable()
{
    Player.OnPlayerDeath += HandlePlayerDeath;
}

private void OnDisable()
{
    Player.OnPlayerDeath -= HandlePlayerDeath;
}
```

### 2. 为什么这里没有“造形状”？关于 Action
你可能也注意到这里没有进行四步操作，少了造形状，即没有手动去写 `public delegate void XXX()`。
因为这里的 **Action 就是形状**，是微软造好的形状，为了避免大量重复的无意义代码。

微软在 C# 2.0/3.0 之后，在 `System` 命名空间里直接内置了一个通用的模板：

```csharp
// 微软系统底层其实早就帮你写了这行代码：
namespace System
{
    public delegate void Action(); 
}
```

* **Action 的本质**：它就是一个已经定义好的、无参数、无返回值（void）的系统委托（形状）。

### 3. 几个语法糖的解释
* `OnPlayerDeath?.Invoke()` = `if (OnPlayerDeath != null) OnPlayerDeath();`
* `OnDeath()` 编译成机器码后，本质上调用的就是委托对象的 `.Invoke()` 方法。
* **实验手册强调**：“直接 `onHit();` 不判空，空盒子当场报错”，改法是 `if (onHit != null) onHit();`。现代 C# 引入了空条件操作符 `?.`，`OnPlayerDeath?.Invoke();` 恰恰就是 `if (OnPlayerDeath != null) OnPlayerDeath.Invoke();` 的语法糖。

---

## 四、 底层的逻辑谬误与真实真相

### 1. 破除认知误区
我误认为声明了一个 `Action OnPlayerDeath` 就是声明了一个无参数无返回值的函数，其实不然。

* 这是一个委托/事件变量，里面装的是**其他函数的内存地址（函数指针/方法指针）**。
* 当写下 `public static event Action OnPlayerDeath;` 时并没有定义任何新函数，只是在内存中声明了一个**空的通讯录名单（list/array 数组）**。
* 这个变量的赋值其实就是订阅的过程：
  ```csharp
  Player.OnPlayerDeath += HandlePlayerDeath; // 这就是在赋值（添加名单）！
  ```
  在底层就是把指向 `HandlePlayerDeath` 这个函数的指针追加给了 `OnPlayerDeath` 链表。

### 2. Invoke() 底层在跑一个 for 循环
`OnPlayerDeath?.Invoke()` 底层在跑一个 for 循环！
在 C# 底层（CLR 虚拟机）中，`Invoke()` 翻译成白话文其实就是这段逻辑：

```csharp
// 这就是 Invoke() 在底层的伪代码还原：
if (OnPlayerDeath != null) // 检查通讯录是不是空的
{
    // 遍历通讯录里所有被 += 挂上去的函数指针
    foreach (var method in OnPlayerDeath.GetInvocationList()) 
    {
        method(); // 挨个顺藤摸瓜，调出对方真正的函数去执行！
    }
}
```

### 3. 编译器在幕后生成的三个东西
当写下 `public static event Action OnPlayerDeath;` 时，C# 编译器在幕后生成了三个东西：

1. **一个私有的多播委托字段（真正的底裤）**：
   ```csharp
   private static Action OnPlayerDeath; // 真正装函数指针链表的对象
   ```
   这个对象内部有两个核心指针字段：
   * `_target`：记录这个方法属于场景里的哪一只具体的敌人（对象实例）。
   * `_methodPtr`：记录这个方法在内存中的机器码地址。

2. **一个专门负责 `+=` 的管理方法（add）**：
   当你写 `Player.OnPlayerDeath += ...` 时，编译器把它转成了：
   ```csharp
   Delegate.Combine(OnPlayerDeath, HandlePlayerDeath);
   ```
   它负责把你的函数指针追加进链表末尾。

3. **一个专门负责 `-=` 的管理方法（remove）**：
   当你写 `Player.OnPlayerDeath -= ...` 时，编译器把它转成了：
   ```csharp
   Delegate.Remove(OnPlayerDeath, HandlePlayerDeath);
   ```
   它负责把这个函数指针从链表里抹掉。

这也是为什么在手册中特别强调 **“谁能触发，是事件与委托唯一的区别”**：
因为加了 `event` 关键字后，C# 规定其他外部脚本只被允许访问 `add`（`+=`）和 `remove`（`-=`），只有发布者自己（`Player`）能直接访问最底层的变量去触发 `Invoke()`。

---

## 五、 static 的相关理解

> **大白话理解**：这个变量全局中只有一个，且所有人都可以修改，且修改后所有人看到的都会变。

**代码示例**：
```csharp
public static int enemyCount;
```

### 核心特点：
1. **属于类本身**：静态成员属于类本身，而不是某一个具体的实例对象，可以通过类名直接访问和修改（比如直接写 `Player.OnPlayerDeath`，不需要 `GetComponent` 找引用）。
2. **生命周期全局存在**：游戏不关就一直在内存中。
   * *(注意：在 Unity 中切关换场景时，`static` 变量不会自动重置，且如果敌人被销毁时没用 `-=` 退订静态事件，会导致内存泄漏或报 `MissingReferenceException` 空引用错误)*。