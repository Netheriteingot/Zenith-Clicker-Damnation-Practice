import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

# 生成线偏振光模型（沿x轴偏振）
z = np.linspace(0, 20, 200)
E_x = np.sin(z)  # 电场在x方向振动
E_y = 0.5 * np.cos(z + 1)  # y方向无振动

fig = plt.figure()
ax = fig.add_subplot(111, projection='3d')
ax.plot(z, E_x, E_y, color='red', label='Electric Field (E)')
ax.set_box_aspect([2, 1, 1])  # Z 轴是 x/y 的 2 倍
ax.set_xlim(0, 20)            # 进一步拉长 Z 轴范围
ax.set_xlabel('Propagation Direction (z)')
ax.set_ylabel('x')
ax.set_zlabel('y')
ax.set_title('Ellipse Polarized Light')
plt.legend()
plt.show()